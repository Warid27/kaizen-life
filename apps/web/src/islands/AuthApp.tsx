import { useEffect, useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  timezone: string;
}

async function postAuth(path: string, body: unknown): Promise<{ user: AuthUser | null }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { user?: AuthUser | null };
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    const err = new Error(json.error?.message ?? 'Something went wrong. Please try again.');
    (err as Error & { code?: string }).code = json.error?.code;
    throw err;
  }
  return { user: json.data?.user ?? null };
}

/** Turn validation noise into actionable field errors. */
function friendlyError(err: unknown): { message: string; field?: 'email' | 'password' } {
  const e = err as Error & { code?: string };
  const msg = e.message ?? '';
  if (e.code === 'EMAIL_TAKEN') {
    return { message: 'An account with this email already exists. Try signing in instead.' };
  }
  if (e.code === 'INVALID_CREDENTIALS') {
    return { message: 'Email or password is incorrect.' };
  }
  if (e.code === 'RATE_LIMITED') {
    return { message: 'Too many attempts. Please wait a minute and try again.' };
  }
  if (msg.includes('Password must be')) {
    return { message: msg, field: 'password' };
  }
  if (msg.toLowerCase().includes('email')) {
    return { message: msg, field: 'email' };
  }
  return { message: msg || 'Something went wrong. Please try again.' };
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function AuthApp() {
  return (
    <QueryProvider>
      <AuthContent />
    </QueryProvider>
  );
}

function AuthContent() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; field?: 'email' | 'password' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const next = (() => {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    const n = params.get('next');
    // Only allow internal paths — never redirect off-site.
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
  })();

  // Already signed in (or auth not enforced)? Go straight to the app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        const json = (await res.json()) as { data?: { user: AuthUser | null } };
        if (!cancelled && json.data?.user) {
          window.location.href = next;
          return;
        }
      } catch {
        // API down — show the form; the user can retry.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await postAuth('/api/auth/register', { name: name.trim(), email: email.trim(), password });
      } else {
        await postAuth('/api/auth/login', { email: email.trim(), password });
      }
      window.location.href = next;
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in to your KaizenLife workspace.'
              : 'One account for your entire life dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  aria-invalid={error?.field === 'email' || undefined}
                  className={cn(error?.field === 'email' && 'border-destructive')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  aria-invalid={error?.field === 'password' || undefined}
                  className={cn(error?.field === 'password' && 'border-destructive')}
                />
                {mode === 'register' && (
                  <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
                )}
              </div>

              {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error.message}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn className="mr-1.5 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-1.5 h-4 w-4" />
                )}
                {submitting
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
