import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth — registration / login payloads (real multi-account groundwork)
// ---------------------------------------------------------------------------

export const RegisterSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email("Must be a valid email address").max(254),
    // 8+ chars: accounts hold a full personal life-log; short passwords are
    // the single weakest link once the API is no longer open.
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
  })
  .strict();

export type Register = z.infer<typeof RegisterSchema>;

export const LoginSchema = z
  .object({
    email: z.string().email("Must be a valid email address").max(254),
    password: z.string().min(1, "Password is required").max(200),
  })
  .strict();

export type Login = z.infer<typeof LoginSchema>;

/** Public shape of a user as returned by auth endpoints (no secrets). */
export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  timezone: z.string(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
