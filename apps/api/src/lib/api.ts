import type { Context } from "hono";
import type { ZodError } from "zod";

// ---------------------------------------------------------------------------
// Unified API error envelope: { error: { code, message, details? } }
// Replaces the three incompatible shapes routes used to hand-roll (A6/B4).
// Success bodies keep their route-specific shape; errors are always this.
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "INTERNAL";

export function apiError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): Response {
  return c.json({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

export function notFound(c: Context, what: string): Response {
  return apiError(c, 404, "NOT_FOUND", `${what} not found`);
}

/** Shared zValidator failure hook — use for every `zValidator(_, _, hook)`. */
export function validationHook(result: { success: true } | { success: false; error: ZodError }, c: Context): Response | undefined {
  if (result.success) return undefined;
  return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", result.error.flatten());
}
