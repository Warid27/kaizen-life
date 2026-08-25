import { useEffect, useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useUserSettings,
  useUpdateSettings,
  useExportData,
  getLocalPrefs,
  saveLocalPrefs,
  applyTheme,
  type ThemePref,
} from '@/queries/settings';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Download,
  Check,
  Loader2,
  FileJson,
  AlertCircle,
  Clock,
  Bell,
} from 'lucide-react';
import { usePushNotifications } from '@/queries/push';

// ─── Default export ───────────────────────────────────────────────────────────

export default function SettingsApp() {
  return (
    <QueryProvider>
      <SettingsContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and app preferences.
        </p>
      </div>

      <ProfileCard />
      <NotificationsCard />
      <AppearanceCard />
      <DataCard />
    </div>
  );
}

// ─── Notifications (Web Push subscription) ────────────────────────────────────

function NotificationsCard() {
  const { loading, subscribed, error, support, toggle } = usePushNotifications();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Notifications
        </CardTitle>
        <CardDescription>
          Daily summaries and due reminders — even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!support ? (
          <Skeleton className="h-10 w-full max-w-sm" />
        ) : !support.supported ? (
          <p className="text-sm text-muted-foreground">{support.reason}</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button onClick={toggle} disabled={loading} variant={subscribed ? 'outline' : 'default'}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {subscribed ? 'Disable push notifications' : 'Enable push notifications'}
              </Button>
              {subscribed && (
                <Badge variant="secondary" className="text-[10px]">
                  enabled
                </Badge>
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Uses your browser's notification permission. You can revoke it anytime from the
              browser's site settings.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Profile (server-backed UserSettings) ─────────────────────────────────────

function ProfileCard() {
  const {
    data: settings,
    isPending,
    error,
    refetch,
  } = useUserSettings();
  const updateMut = useUpdateSettings();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');
  const [deviceTz, setDeviceTz] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync draft inputs when the server record loads/changes.
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!settings) return;
    if (syncedAt === settings.updatedAt) return;
    setSyncedAt(settings.updatedAt);
    setName(settings.name ?? '');
    setEmail(settings.email ?? '');
    setTimezone(settings.timezone ?? '');
  }, [settings, syncedAt]);

  // Client-side suggestion only (never sent until the user saves).
  useEffect(() => {
    try {
      setDeviceTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setDeviceTz('');
    }
  }, []);

  const canSave =
    !updateMut.isPending && name.trim().length > 0 && timezone.trim().length > 0;

  const handleSave = () => {
    setSaveError(null);
    setSaved(false);
    updateMut.mutate(
      {
        name: name.trim(),
        email: email.trim() ? email.trim() : null,
        timezone: timezone.trim(),
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: (err) => {
          setSaveError(
            err instanceof Error && err.message
              ? err.message
              : 'Failed to save settings. Please try again.',
          );
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Profile
        </CardTitle>
        <CardDescription>
          Your account details, stored on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Jakarta"
                  className="max-w-xs"
                />
                {deviceTz && deviceTz !== timezone.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-center"
                    onClick={() => setTimezone(deviceTz)}
                  >
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    Use device timezone ({deviceTz})
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                IANA timezone name used for date calculations.
              </p>
            </div>

            {(saveError || saved) &&
              (saveError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {saveError}
                </p>
              ) : (
                <p
                  role="status"
                  className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <Check className="h-4 w-4" /> Saved!
                </p>
              ))}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!canSave}>
                {updateMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {updateMut.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Appearance (local-only preference) ───────────────────────────────────────

function AppearanceCard() {
  const [theme, setTheme] = useState<ThemePref>(() => getLocalPrefs().theme);

  const handleTheme = (value: ThemePref) => {
    setTheme(value);
    saveLocalPrefs({ theme: value });
    applyTheme(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Theme is stored locally in this browser.
          <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
            local only
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select
            id="theme"
            value={theme}
            onChange={(e) => handleTheme(e.target.value as ThemePref)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Data export ──────────────────────────────────────────────────────────────

function DataCard() {
  const exportData = useExportData();
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = () => {
    setExportError(null);
    exportData.mutate(undefined, {
      onError: (err) => {
        setExportError(
          err instanceof Error && err.message
            ? err.message
            : 'Failed to start export. Please try again.',
        );
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>
          Download all your data as a JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={handleExport} disabled={exportData.isPending} variant="outline">
          {exportData.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="mr-2 h-4 w-4" />
          )}
          Export JSON
        </Button>
        {exportError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {exportError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
