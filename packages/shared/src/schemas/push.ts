import { z } from "zod";

/**
 * Browser Push API subscription (RFC 8291 key material), as produced by
 * `pushManager.subscribe()`. `endpoint` is the push-service URL and is used
 * as the natural unique key server-side.
 */
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    /** Base64url-encoded client public key (P-256, uncompressed). */
    p256dh: z.string().min(1),
    /** Base64url-encoded authentication secret. */
    auth: z.string().min(1),
  }),
});
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

export const DeletePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});
export type DeletePushSubscription = z.infer<typeof DeletePushSubscriptionSchema>;
