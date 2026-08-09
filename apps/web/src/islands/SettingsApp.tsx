import { useState, useEffect, useCallback } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useUserSettings,
  useUpdateSettings,
  useBackups,
  useCreateBackup,
  useExportData,
  getLocalSettings,
  saveLocalSettings,
  type UserSettings,
} from '@/queries/settings';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  User,
  Bell,
  Activity,
  Download,
  RefreshCw,
  Check,
  Loader2,
  Database,
  FileJson,
  AlertCircle,
} from 'lucide-react';

// ─── Default export ───────────────────────────────────────────────────────────

export default function SettingsApp() {
  return (
    <QueryProvider>
      <SettingsContent />
    </QueryProvider>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile', label: 'Profile & Preferences', icon: User },
  { id: 'habits', label: 'Habit Configuration', icon: Activity },
  { id: 'notifications', label: 'Notification Settings', icon: Bell },
  { id: 'backup', label: 'Backup & Export', icon: Download },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Main content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, preferences, and app configuration.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'habits' && <HabitsTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'backup' && <BackupTab />}
    </div>
  );
}

// ─── Profile & Preferences Tab ────────────────────────────────────────────────

function ProfileTab() {
  const [settings, setSettings] = useState<UserSettings>(getLocalSettings);
  const [saved, setSaved] = useState(false);
  const updateSettings = useUpdateSettings();

  const handleSave = useCallback(() => {
    saveLocalSettings(settings);
    updateSettings.mutate(settings, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => {
        // Still saved locally
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }, [settings, updateSettings]);

  return (
    <div className="space-y-4">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize how KaizenLife looks and behaves.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                id="theme"
                value={settings.theme}
                onChange={(e) =>
                  setSettings({ ...settings, theme: e.target.value as UserSettings['theme'] })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                id="language"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="id">Bahasa Indonesia</option>
                <option value="ja">日本語</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Habit Configuration Tab ──────────────────────────────────────────────────

function HabitsTab() {
  const [settings, setSettings] = useState<UserSettings>(getLocalSettings);
  const [saved, setSaved] = useState(false);
  const updateSettings = useUpdateSettings();

  const handleSave = useCallback(() => {
    saveLocalSettings(settings);
    updateSettings.mutate(settings, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }, [settings, updateSettings]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Habit Defaults</CardTitle>
          <CardDescription>
            Configure default settings for new habits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-freq">Default Frequency</Label>
              <Select
                id="default-freq"
                value={settings.habits.defaultFrequency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    habits: { ...settings.habits, defaultFrequency: e.target.value },
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="weekdays">Weekdays Only</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-start">Week Starts On</Label>
              <Select
                id="week-start"
                value={settings.habits.weekStartsOn}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    habits: {
                      ...settings.habits,
                      weekStartsOn: e.target.value as 'monday' | 'sunday',
                    },
                  })
                }
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Show Completed Habits</p>
              <p className="text-xs text-muted-foreground">
                Display completed habits on the daily view.
              </p>
            </div>
            <button
              onClick={() =>
                setSettings({
                  ...settings,
                  habits: {
                    ...settings.habits,
                    showCompletedHabits: !settings.habits.showCompletedHabits,
                  },
                })
              }
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                settings.habits.showCompletedHabits ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                  settings.habits.showCompletedHabits
                    ? 'translate-x-6'
                    : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Notification Settings Tab ────────────────────────────────────────────────

function NotificationsTab() {
  const [settings, setSettings] = useState<UserSettings>(getLocalSettings);
  const [saved, setSaved] = useState(false);
  const updateSettings = useUpdateSettings();

  const toggle = useCallback(
    (key: keyof UserSettings['notifications']) => {
      setSettings({
        ...settings,
        notifications: {
          ...settings.notifications,
          [key]: !settings.notifications[key],
        },
      });
    },
    [settings],
  );

  const handleSave = useCallback(() => {
    saveLocalSettings(settings);
    updateSettings.mutate(settings, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }, [settings, updateSettings]);

  const notifItems: {
    key: keyof UserSettings['notifications'];
    label: string;
    description: string;
  }[] = [
    {
      key: 'push',
      label: 'Push Notifications',
      description: 'Receive browser push notifications.',
    },
    {
      key: 'email',
      label: 'Email Notifications',
      description: 'Receive daily summary via email.',
    },
    {
      key: 'habitReminders',
      label: 'Habit Reminders',
      description: 'Get reminded when it\'s time to log habits.',
    },
    {
      key: 'taskDeadlines',
      label: 'Task Deadlines',
      description: 'Notifications for upcoming and overdue tasks.',
    },
    {
      key: 'dailyCheckIn',
      label: 'Daily Check-In',
      description: 'Reminder to complete your daily check-in.',
    },
    {
      key: 'weeklyReview',
      label: 'Weekly Review',
      description: 'Reminder for your weekly review and planning.',
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose which notifications you'd like to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {notifItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                  settings.notifications[item.key] ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                    settings.notifications[item.key]
                      ? 'translate-x-6'
                      : 'translate-x-1',
                  )}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Backup & Export Tab ──────────────────────────────────────────────────────

function BackupTab() {
  const { data: backups, isLoading: backupsLoading } = useBackups();
  const createBackup = useCreateBackup();
  const exportData = useExportData();

  const handleExport = useCallback(() => {
    exportData.mutate(undefined, {
      onSuccess: (res) => {
        const url = res.data?.downloadUrl;
        if (url) {
          window.open(url, '_blank');
        }
      },
      onError: () => {
        // Fallback: export all data as JSON from localStorage
        const allData: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('kaizenlife')) {
            try {
              allData[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
            } catch {
              allData[key] = localStorage.getItem(key);
            }
          }
        }
        const blob = new Blob([JSON.stringify(allData, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kaizenlife-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    });
  }, [exportData]);

  const handleBackup = useCallback(() => {
    createBackup.mutate();
  }, [createBackup]);

  return (
    <div className="space-y-4">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Download all your data as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exportData.isPending} variant="outline">
            {exportData.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="mr-2 h-4 w-4" />
            )}
            Export JSON
          </Button>
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>
            Create a snapshot backup of your data on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleBackup} disabled={createBackup.isPending}>
            {createBackup.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Backup Now
          </Button>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>Previous backups stored on the server.</CardDescription>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !backups || backups.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              No backups yet. Create your first backup above.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(backup.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(backup.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={backup.type === 'manual' ? 'secondary' : 'default'}>
                    {backup.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
