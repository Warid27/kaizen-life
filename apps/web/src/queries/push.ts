import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';

// ─── API contracts ────────────────────────────────────────────────────────────

type VapidKeyResponse = { data: { publicKey: string | null } };
type SubscriptionResponse = { data: { success: boolean } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base64url (VAPID applicationServerKey) → Uint8Array as PushManager requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushSupport =
  | { supported: true; permission: NotificationPermission }
  | { supported: false; reason: string };

async function getPushSupport(): Promise<PushSupport> {
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Service workers are not supported in this browser' };
  if (!('PushManager' in window)) return { supported: false, reason: 'Push is not supported in this browser' };
  if (!('Notification' in window)) return { supported: false, reason: 'Notifications are not supported in this browser' };
  return { supported: true, permission: Notification.permission };
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // The SW registers on app load (BaseLayout); wait for it here.
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

/** Current push subscription, or null when unsubscribed. */
async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

async function subscribeToPush(): Promise<void> {
  const { data } = await apiGet<VapidKeyResponse>('/api/push/vapid-public-key');
  if (!data.publicKey) throw new Error('Push notifications are not configured on the server');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was denied');

  const reg = await getRegistration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey) as unknown as BufferSource,
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser returned an incomplete subscription');
  }

  await apiPost<SubscriptionResponse>('/api/push/subscriptions', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  localStorage.setItem('kaizenlife:push', 'on');
}

async function unsubscribeFromPush(): Promise<void> {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      // Server DELETE is scoped to endpoint + caller.
      await apiDelete<SubscriptionResponse>('/api/push/subscriptions', { endpoint: sub.endpoint });
    } catch {
      // Server may already have pruned it — still unsubscribe locally.
    }
    await sub.unsubscribe();
  }
  localStorage.setItem('kaizenlife:push', 'off');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UsePushState {
  loading: boolean;
  subscribed: boolean;
  error: string | null;
  support: PushSupport | null;
  toggle: () => Promise<void>;
  refresh: () => void;
}

export function usePushNotifications(): UsePushState {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getPushSupport();
      if (cancelled) return;
      setSupport(s);
      if (s.supported) {
        const sub = await getCurrentSubscription().catch(() => null);
        if (!cancelled) setSubscribed(!!sub);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const toggle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush();
        setSubscribed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  }, [subscribed]);

  return { loading, subscribed, error, support, toggle, refresh };
}
