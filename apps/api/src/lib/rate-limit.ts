// ---------------------------------------------------------------------------
// Best-effort rate limiting for sensitive endpoints (auth).
//
// CAVEAT: Workers isolates are per-colo and ephemeral — this Map only bounds
// bursts from a single IP within one isolate. It stops credential-stuffing
// scripts from hammering login in a tight loop, but is NOT a global quota
// (that would need KV/DO/Durable Objects). Chosen deliberately: no extra
// service dependency for a single-user app.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Periodically drop expired buckets so the Map cannot grow unbounded. */
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSec: number;
}

/** Fixed-window limiter: `limit` requests per `windowMs` per key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from Workers headers; falls back to "unknown". */
export function clientIp(headers: Headers): string {
  return (
    headers.get("CF-Connecting-IP") ??
    headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Clear all buckets (test helper — buckets are per-isolate module state). */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
