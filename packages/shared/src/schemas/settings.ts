import { z } from "zod";

// ─── Settings (users table projection) ──────────────────────────────────────

/** Full settings record as returned by GET /api/settings. */
export const SettingsSchema = z.object({
  name: z.string(),
  email: z.string().nullable().optional(),
  timezone: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** PATCH /api/settings body — every field optional. */
export const UpdateSettingsSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().nullable().optional(),
    // Must be a valid IANA timezone; server falls back to UTC otherwise.
    timezone: z.string().min(1).max(64).optional(),
  })
  .strict();

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
