// ---------------------------------------------------------------------------
// Auth primitives: PBKDF2 password hashing + HMAC-signed session tokens.
// Pure WebCrypto — runs on Cloudflare Workers and in Bun (tests) unchanged.
// ---------------------------------------------------------------------------

import type { Context } from "hono";

const SESSION_COOKIE = "kaizen_session";
/** 30 days — long-lived personal dashboard, re-login is monthly at worst. */
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export const DEFAULT_PBKDF2_ITERATIONS = 100_000;

// ─── Password hashing (PBKDF2-SHA256, per-user salt) ────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function iterationsFromEnv(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  // Clamp to a sane range; free-tier Workers have tight CPU limits, so the
  // count is tunable via PBKDF2_ITERATIONS without code changes.
  if (Number.isFinite(n) && n >= 10_000 && n <= 1_000_000) return n;
  return DEFAULT_PBKDF2_ITERATIONS;
}

/**
 * Hash a password. Format: `pbkdf2$<iterations>$<saltHex>$<hashHex>` —
 * iterations are stored so they can be raised later without invalidating
 * existing hashes (rehash-on-login can compare and upgrade).
 */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

/** Constant-time byte comparison (no early exit on mismatch). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Verify a password against a stored `pbkdf2$…` hash. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1]!, 10);
  const salt = fromHex(parts[2]!);
  const expected = fromHex(parts[3]!);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

// ─── Session tokens (HMAC-SHA256 signed, stateless) ─────────────────────────

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SessionPayload {
  uid: string;
  iat: number;
  exp: number;
}

async function hmac(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}

/** Create a signed session token: `<b64url(payload)>.<b64url(hmac)>`. */
export async function createSessionToken(
  userId: string,
  secret: string,
  ttlSec: number = SESSION_TTL_SEC,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { uid: userId, iat: now, exp: now + ttlSec };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(secret, new TextEncoder().encode(body));
  return { token: `${body}.${b64urlEncode(sig)}`, expiresAt: payload.exp };
}

/** Verify a session token; returns the payload or null when invalid/expired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = await hmac(secret, new TextEncoder().encode(body));
  let providedSig: Uint8Array;
  try {
    providedSig = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as SessionPayload;
    if (
      typeof payload.uid !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

export function getSessionTokenFromRequest(c: Context): string | undefined {
  const header = c.req.header("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return part.slice(eq + 1).trim() || undefined;
    }
  }
  return undefined;
}

/** Set-Cookie header value for a fresh session. */
export function sessionSetCookie(token: string, maxAgeSec: number, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** Set-Cookie header value that clears the session. */
export function sessionClearCookie(secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
