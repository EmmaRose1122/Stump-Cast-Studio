import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION } from '@stumpcast/shared';
import { api, ApiError } from './lib/api';
import { useLiveSocket } from './lib/live';
import { navigate, useRoute } from './lib/router';
import { useShortcuts, type ShortcutAction } from './lib/shortcuts';
import { Gallery } from './pages/Gallery';
import { LivePage } from './pages/Live';
import { PlayersPage } from './pages/Players';
import { ProLook2Page } from './pages/ProLook2';
import { SetupPage } from './pages/Setup';
import { GraphicsPage } from './pages/Graphics';
import { HelpPage, SettingsPage, VideoPage } from './pages/pages';
import { SoundsPage } from './pages/Sounds';
import { ExtensionPage } from './pages/Extension';
import { ResolutionTester } from './pages/ResolutionTester';
import { AppShell } from './shell/AppShell';
import { UpdateRequired, type UpdateInfo } from './shell/UpdateRequired';
import { ErrorBoundary } from './shell/ErrorBoundary';
import { useAdmin } from './store';
import { Toaster, TooltipProvider } from './ui';

const PAGES: Record<string, () => React.ReactElement> = {
  '/live': LivePage,
  '/graphics': GraphicsPage,
  '/pro-look-2': ProLook2Page,
  '/video': VideoPage,
  '/sounds': SoundsPage,
  '/players': PlayersPage,
  '/extension': ExtensionPage,
  '/settings': SettingsPage,
  '/help': HelpPage,
  '/gallery': Gallery,
  '/setup': SetupPage,
};

/** What `/api/app/update-check` answers, narrowed to what the gate screen needs. */
type GatePayload = UpdateInfo & { updateAvailable: boolean };

const Root = () => {
  const route = useRoute();
  const toast = useAdmin((s) => s.toast);
  const setAlarm = useAdmin((s) => s.setAlarm);
  useLiveSocket();

  // First run: open the setup wizard once per session until it has been completed.
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  useEffect(() => {
    if (!settings.data || settings.data.setupComplete) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem('stumpcast.setup.dismissed') === '1';
    } catch {
      /* ignore */
    }
    if (!dismissed && route === '/live') navigate('/setup');
  }, [settings.data, route]);

  const alarm = useQuery({ queryKey: ['alarm'], queryFn: api.alarm, refetchInterval: 10_000 });
  useEffect(() => {
    if (alarm.data) setAlarm(alarm.data);
  }, [alarm.data, setAlarm]);

  /**
   * Forced update gate. A successful check that finds a newer build closes the studio: the only
   * screen is the updater. The check fails open — if the release feed cannot be reached, the app
   * runs as before, because a venue without internet must still be able to broadcast.
   */
  const update = useQuery<GatePayload>({
    queryKey: ['update-gate'],
    queryFn: async () => {
      const res = await fetch(`/api/app/update-check?current=${encodeURIComponent(APP_VERSION)}`);
      if (!res.ok) return { updateAvailable: false, latestVersion: APP_VERSION };
      return (await res.json()) as GatePayload;
    },
    refetchInterval: 60_000,
    retry: 0,
  });

  // Once a check has found a newer build, the studio stays closed for this session even if a
  // later poll fails: a flaky feed must not reopen the door on an old engine.
  const [gate, setGate] = useState<GatePayload | null>(null);
  useEffect(() => {
    if (update.data?.updateAvailable) setGate(update.data);
  }, [update.data]);
  const updateInfo = gate ?? update.data;
  const blocked = Boolean(updateInfo?.updateAvailable);

  const onShortcut = useCallback(
    (a: ShortcutAction) => {
      if (blocked) return;
      const done = (p: Promise<unknown>) =>
        p.catch((e: unknown) => {
          // Card control (director) is a later build; say so instead of failing silently.
          const unavailable = e instanceof ApiError && e.status === 404;
          toast({
            title: unavailable ? 'Card control is not available yet' : 'Could not change the card',
            kind: 'error',
          });
        });
      if (a.type === 'card') void done(api.showCard(a.cardId));
      else if (a.type === 'hide') void done(api.hideCard());
      else navigate(a.route);
    },
    [blocked, toast],
  );
  useShortcuts(onShortcut);

  if (blocked && updateInfo) {
    return <UpdateRequired info={{ ...updateInfo, currentVersion: updateInfo.currentVersion || APP_VERSION }} />;
  }

  const Page = PAGES[route] ?? LivePage;
  if (route === '/resolution') return <ResolutionTester />;
  return (
    <TooltipProvider>
      <AppShell route={route}>
        <ErrorBoundary pageKey={route}>
          <Page />
        </ErrorBoundary>
      </AppShell>
      <Toaster />
    </TooltipProvider>
  );
};

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export const App = () => (
  <QueryClientProvider client={client}>
    <Root />
  </QueryClientProvider>
);
