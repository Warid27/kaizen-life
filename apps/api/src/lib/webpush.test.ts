import { describe, it, expect } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  buildVapidAuthHeader,
  encryptPushPayload,
  generateVapidKeys,
  importVapidKeys,
} from "./webpush";

const te = (s: string) => new TextEncoder().encode(s);
const td = (b: Uint8Array) => new TextDecoder().decode(b);

/** Copy a Uint8Array into a plain ArrayBuffer (satisfies SubtleCrypto overloads). */
function tb(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// Minimal WebCrypto type shims — the API tsconfig has no DOM lib.
type EcKeyGenParams = { name: string; namedCurve: string };
interface JsonWebKey {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
}

async function hkdfBits(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lenBytes: number) {
  const key = await crypto.subtle.importKey("raw", tb(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: tb(salt), info: tb(info) },
      key,
      lenBytes * 8,
    ),
  );
}

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    const enc = base64UrlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlDecode(enc))).toEqual(Array.from(bytes));
  });
});

describe("VAPID keys", () => {
  it("generates a valid 65-byte uncompressed public key", async () => {
    const keys = await generateVapidKeys();
    const raw = base64UrlDecode(keys.publicKey);
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    expect(base64UrlDecode(keys.privateKey).length).toBe(32);
  });

  it("importVapidKeys rejects malformed public keys", async () => {
    await expect(importVapidKeys({ publicKey: "AAAA", privateKey: "AA" })).rejects.toThrow(
      /Invalid VAPID public key/,
    );
  });
});

describe("buildVapidAuthHeader", () => {
  it("produces a verifiable ES256 JWT with aud/sub/exp claims", async () => {
    const vapid = await generateVapidKeys();
    const { jwk } = await importVapidKeys(vapid);

    const header = await buildVapidAuthHeader(
      "https://fcm.googleapis.com",
      "mailto:test@example.com",
      vapid,
      1_700_000_000,
    );

    const m = header.match(/^vapid t=(.+?)\.([A-Za-z0-9_-]+), k=([A-Za-z0-9_-]+)$/);
    expect(m).not.toBeNull();
    const [, signingInput, sigB64, keyB64] = m as unknown as [string, string, string, string];
    expect(keyB64).toBe(vapid.publicKey);

    const [hB64, pB64] = signingInput.split(".");
    const hdr = JSON.parse(td(base64UrlDecode(hB64!)));
    expect(hdr).toEqual({ typ: "JWT", alg: "ES256" });
    const payload = JSON.parse(td(base64UrlDecode(pB64!)));
    expect(payload.aud).toBe("https://fcm.googleapis.com");
    expect(payload.sub).toBe("mailto:test@example.com");
    expect(payload.exp).toBe(1_700_000_000 + 12 * 3600);

    const pubKey = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      tb(base64UrlDecode(sigB64)),
      tb(te(signingInput)),
    );
    expect(ok).toBe(true);
  });

  it("prefixes subject with mailto: when missing", async () => {
    const vapid = await generateVapidKeys();
    const header = await buildVapidAuthHeader("https://x.example", "a@b.c", vapid);
    const pB64 = header.split(".")[1]!;
    const payload = JSON.parse(td(base64UrlDecode(pB64)));
    expect(payload.sub).toBe("mailto:a@b.c");
  });
});

/** Client-side mirror (RFC 8291 §3.3 receiver role) to prove decryptability. */
async function clientDecrypt(
  body: Uint8Array,
  clientPrivJwk: JsonWebKey,
  authSecret: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16);
  const view = new DataView(tb(body));
  const recordSize = view.getUint32(16);
  const idlen = body[20]!;
  expect(idlen).toBe(65);
  const asPubBytes = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  expect(recordSize).toBe(4096);
  expect(asPubBytes[0]).toBe(0x04);

  // Client private ↔ server ephemeral public ECDH.
  const clientKey = await crypto.subtle.importKey(
    "jwk",
    clientPrivJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const asPub = await crypto.subtle.importKey(
    "raw",
    tb(asPubBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asPub }, clientKey, 256),
  );

  // Our own public key in raw form.
  const clientPubRaw = new Uint8Array(
    await crypto.subtle.exportKey(
      "raw",
      await crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x: clientPrivJwk.x, y: clientPrivJwk.y },
        { name: "ECDH", namedCurve: "P-256" },
        true,
        [],
      ),
    ),
  );

  // PRK_key = HKDF(auth, ecdh, "WebPush: info" ‖ 0x00 ‖ ua_pub ‖ as_pub)
  const prkInfo = (() => {
    const label = te("WebPush: info");
    const out = new Uint8Array(label.length + 1 + clientPubRaw.length + asPubBytes.length);
    out.set(label, 0);
    out[label.length] = 0x00;
    out.set(clientPubRaw, label.length + 1);
    out.set(asPubBytes, label.length + 1 + clientPubRaw.length);
    return out;
  })();
  const prkKey = await hkdfBits(authSecret, ecdhSecret, prkInfo, 32);

  const cek = await hkdfBits(salt, prkKey, te("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdfBits(salt, prkKey, te("Content-Encoding: nonce\u0000"), 12);

  const decKey = await crypto.subtle.importKey("raw", tb(cek), "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: tb(nonce) }, decKey, tb(ciphertext)),
  );

  expect(plaintext[plaintext.length - 1]).toBe(0x02); // last-record delimiter
  return td(plaintext.slice(0, -1));
}

/** Fake browser subscription to exercise the full encrypt/decrypt loop. */
async function makeFakeSubscription() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    p256dh: base64UrlEncode(pubRaw),
    auth: base64UrlEncode(authSecret),
    privJwk,
    authSecret,
  };
}

describe("encryptPushPayload (RFC 8291 aes128gcm)", () => {
  it("produces a ciphertext only the subscription holder can read", async () => {
    const sub = await makeFakeSubscription();

    const { body } = await encryptPushPayload(
      JSON.stringify({ title: "Hello", body: "World" }),
      sub.p256dh,
      sub.auth,
    );

    expect(body.length).toBeGreaterThan(21 + 17 + 2);
    const decrypted = await clientDecrypt(body, sub.privJwk, sub.authSecret);
    expect(JSON.parse(decrypted)).toEqual({ title: "Hello", body: "World" });
  });

  it("rejects decryption with a wrong auth secret", async () => {
    const sub = await makeFakeSubscription();
    const { body } = await encryptPushPayload("secret", sub.p256dh, sub.auth);
    await expect(
      clientDecrypt(body, sub.privJwk, crypto.getRandomValues(new Uint8Array(16))),
    ).rejects.toThrow();
  });

  it("uses a fresh salt and ephemeral key per message", async () => {
    const sub = await makeFakeSubscription();
    const a = await encryptPushPayload("same", sub.p256dh, sub.auth);
    const b = await encryptPushPayload("same", sub.p256dh, sub.auth);
    expect(Array.from(a.body.slice(0, 16))).not.toEqual(Array.from(b.body.slice(0, 16)));
    expect(Array.from(a.ephemeralPublicKey)).not.toEqual(Array.from(b.ephemeralPublicKey));
  });
});
