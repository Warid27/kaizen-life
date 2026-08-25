const BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Unified server error envelope: { error: { code, message, details? } } */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  /** Machine-readable code from the unified envelope ("VALIDATION_ERROR", …) */
  public code?: string;
  /** Field-level details (e.g. Zod flatten output) when provided */
  public details?: unknown;

  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    const envelope =
      body && typeof body === 'object' && 'error' in body
        ? ((body as { error?: ApiErrorBody }).error ?? {})
        : {};
    super(message ?? envelope.message ?? `API error ${status}`);
    this.name = 'ApiError';
    this.code = envelope.code;
    this.details = envelope.details;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryString(
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, params, headers = {}, signal } = options;

  const url = `${BASE_URL}${path}${buildQueryString(params)}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    // Sessions ride an HttpOnly cookie on the API origin; the web app lives
    // on a different origin, so every request must opt into sending it.
    credentials: 'include',
  });

  if (!res.ok) {
    // Auth enforced (401 from a guarded route): bounce to login once, keeping
    // the current page as the post-login destination. Auth endpoints and the
    // login page itself are exempt to avoid loops.
    if (
      res.status === 401 &&
      !path.startsWith('/api/auth') &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }

    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new ApiError(res.status, errorBody);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method: 'GET', params, signal });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body, signal });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body, signal });
}

export function apiDelete<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE', body, signal });
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body, signal });
}
