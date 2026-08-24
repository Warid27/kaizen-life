// ─────────────────────────────────────────────────────────────────────────────
// Web Push for Cloudflare Workers — dependency-free WebCrypto implementation.
//
// Implements exactly what is needed to deliver encrypted web-push messages:
//   • VAPID (RFC 8292): ES256-signed JWT in the Authorization header.
//   • Payload encryption (RFC 8291) using the aes128gcm content encoding
//     (RFC 8188) that every modern browser requires.
//
// All primitives come from the WebCrypto SubtleCrypto API, which is available
// in Workers and in Node ≥ 16 (so the same code runs under vitest).
// ─────────────────────────────────────────────────────────────────────────────

/** Copy a Uint8Array into a plain ArrayBuffer (satisfies SubtleCrypto overloads). */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
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

// ─── base64url helpers ───────────────────────────────────────────────────────

export function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let raw = "";
  for (let i = 0; i < view.length; i++) raw += String.fromCharCode(view[i] ?? 0);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ─── VAPID key handling ──────────────────────────────────────────────────────

/** A VAPID keypair: base64url public key ("ApplicationServerKey") + private scalar. */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface EcPrivateJwk extends JsonWebKey {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d: string;
}

/**
 * Import a VAPID keypair into a usable form.
 * `publicKey` is the standard 65-byte uncompressed P-256 point (base64url),
 * `privateKey` is the raw 32-byte scalar d (base64url).
 */
export async function importVapidKeys(keys: VapidKeys): Promise<{ jwk: EcPrivateJwk }> {
  const pubBytes = base64UrlDecode(keys.publicKey);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("Invalid VAPID public key: expected 65-byte uncompressed P-256 point");
  }
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));
  return {
    jwk: { kty: "EC", crv: "P-256", x, y, d: keys.privateKey },
  };
}

/**
 * Generate a fresh VAPID keypair. Returns base64url-encoded public/private
 * material suitable for `importVapidKeys`, wrangler secrets, and as the
 * `applicationServerKey` passed to pushManager.subscribe().
 */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return {
    publicKey: base64UrlEncode(pub),
    privateKey: jwk.d as string,
  };
}

// ─── VAPID JWT (RFC 8292) ────────────────────────────────────────────────────

const JWT_HEADER = base64UrlEncode(utf8Encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));

/**
 * Build the `Authorization: vapid t=<jwt>, k=<key>` header value for one
 * push endpoint. `aud` must be the origin of the endpoint URL.
 */
export async function buildVapidAuthHeader(
  aud: string,
  subject: string,
  keys: VapidKeys,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const { jwk } = await importVapidKeys(keys);
  const claims = JSON.stringify({
    aud,
    sub: subject.startsWith("mailto:") ? subject : `mailto:${subject}`,
    exp: nowSeconds + 12 * 3600,
  });
  const payload = base64UrlEncode(utf8Encode(claims));
  const signingInput = `${JWT_HEADER}.${payload}`;

  const privKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto ECDSA signatures are already raw r||s (64 bytes) — what ES256 needs.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    toBuffer(utf8Encode(signingInput)),
  );
  return `vapid t=${signingInput}.${base64UrlEncode(sig)}, k=${keys.publicKey}`;
}

// ─── Payload encryption (RFC 8291 aes128gcm / RFC 8188) ──────────────────────

const RECORD_SIZE = 4096;

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toBuffer(ikm), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(salt), info: toBuffer(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Encrypt a JSON payload for a specific subscription per RFC 8291 with the
 * aes128gcm content encoding. Returns the request body to POST.
 */
export async function encryptPushPayload(
  payloadJson: string,
  p256dhB64url: string,
  authB64url: string,
): Promise<{ body: Uint8Array; ephemeralPublicKey: Uint8Array }> {
  // Client public key → imported ECDH key for key agreement.
  const clientPubBytes = base64UrlDecode(p256dhB64url);
  const clientJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(clientPubBytes.slice(1, 33)),
    y: base64UrlEncode(clientPubBytes.slice(33, 65)),
  };
  const clientKey = await crypto.subtle.importKey(
    "jwk",
    clientJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Ephemeral sender keypair.
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256),
  );

  const authSecret = base64UrlDecode(authB64url);
  const asPubBytes = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  // PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info" ‖ 0x00 ‖ ua_pub ‖ as_pub)
  const prkKey = await hkdf(
    authSecret,
    ecdhSecret,
    concatBytes(utf8Encode("WebPush: info"), new Uint8Array(1), clientPubBytes, asPubBytes),
    32,
  );

  // Fresh salt per message.
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cek = await hkdf(salt, prkKey, utf8Encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdf(salt, prkKey, utf8Encode("Content-Encoding: nonce\u0000"), 12);

  // Record plaintext: payload ‖ 0x02 delimiter (last record).
  const plaintext = concatBytes(utf8Encode(payloadJson), new Uint8Array([0x02]));
  if (plaintext.length > RECORD_SIZE - 17) {
    throw new Error("Push payload too large for a single record");
  }

  const encKey = await crypto.subtle.importKey("raw", toBuffer(cek), "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuffer(nonce) }, encKey, toBuffer(plaintext)),
  );

  // aes128gcm header: salt(16) ‖ rs(4 BE) ‖ idlen(1)=65 ‖ as_pub(65)
  const rs = new Uint8Array(4);
  rs[0] = (RECORD_SIZE >>> 24) & 0xff;
  rs[1] = (RECORD_SIZE >>> 16) & 0xff;
  rs[2] = (RECORD_SIZE >>> 8) & 0xff;
  rs[3] = RECORD_SIZE & 0xff;
  const header = concatBytes(salt, rs, new Uint8Array([asPubBytes.length]), asPubBytes);

  return { body: concatBytes(header, ciphertext), ephemeralPublicKey: asPubBytes };
}

// ─── Delivery ────────────────────────────────────────────────────────────────

export interface PushMessagePayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export type SendPushResult = "sent" | "gone" | "error";

/**
 * Send an encrypted notification to one subscription endpoint.
 * Returns "gone" when the endpoint has been unsubscribed/expired (HTTP 404/410)
 * so callers can prune the row.
 */
export async function sendPushNotification(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: PushMessagePayload;
  vapidKeys: VapidKeys;
  vapidSubject: string;
}): Promise<SendPushResult> {
  try {
    const { body } = await encryptPushPayload(
      JSON.stringify(opts.payload),
      opts.p256dh,
      opts.auth,
    );
    const aud = new URL(opts.endpoint).origin;
    const authorization = await buildVapidAuthHeader(aud, opts.vapidSubject, opts.vapidKeys);

    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "normal",
      },
      body: toBuffer(body),
    });

    if (res.ok) return "sent";
    if (res.status === 404 || res.status === 410) return "gone";
    console.error(`sendPushNotification: endpoint returned ${res.status}`);
    return "error";
  } catch (err) {
    console.error("sendPushNotification failed:", err);
    return "error";
  }
}
