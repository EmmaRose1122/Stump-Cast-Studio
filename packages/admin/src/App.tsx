import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { api, ApiError } from './lib/api';
import { useLiveSocket } from './lib/live';
import { navigate, useRoute } from './lib/router';
import { useShortcuts, type ShortcutAction } from './lib/shortcuts';
import { Gallery } from './pages/Gallery';
import { LivePage } from './pages/Live';
import { PlayersPage } from './pages/Players';
import { SetupPage } from './pages/Setup';
import { GraphicsPage } from './pages/Graphics';
import { HelpPage, SettingsPage, VideoPage } from './pages/pages';
import { SoundsPage } from './pages/Sounds';
import { ExtensionPage } from './pages/Extension';
import { ResolutionTester } from './pages/ResolutionTester';
import { AppShell } from './shell/AppShell';
import { useAdmin } from './store';
import { Toaster, TooltipProvider } from './ui';

const PAGES: Record<string, () => React.ReactElement> = {
  '/live': LivePage,
  '/graphics': GraphicsPage,
  '/video': VideoPage,
  '/sounds': SoundsPage,
  '/players': PlayersPage,
  '/extension': ExtensionPage,
  '/settings': SettingsPage,
  '/help': HelpPage,
  '/gallery': Gallery,
  '/setup': SetupPage,
};

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

  const onShortcut = useCallback(
    (a: ShortcutAction) => {
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
    [toast],
  );
  useShortcuts(onShortcut);

  const Page = PAGES[route] ?? LivePage;
  if (route === '/resolution') return <ResolutionTester />;
  return (
    <TooltipProvider>
      <AppShell route={route}>
        <Page />
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
