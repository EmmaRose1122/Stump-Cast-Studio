import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useAdmin } from '../store';
import { Button, Card } from '../ui';

export const ExtensionPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const [urlDraft, setUrlDraft] = useState('');

  const provider = useQuery({
    queryKey: ['provider'],
    queryFn: api.providerStatus,
    refetchInterval: 2000,
  });
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });

  const saveSettings = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => qc.setQueryData(['settings'], s),
    onError: () => toast({ title: 'Could not save', kind: 'error' }),
  });

  const openMatch = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch('/api/ext/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: 'openMatch', url }),
      });
      if (!res.ok) throw new Error('Could not send command');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Opening match page...', kind: 'success' });
      setUrlDraft('');
    },
    onError: () => toast({ title: 'Could not open match. Is the extension connected?', kind: 'error' }),
  });

  const health = provider.data?.health ?? 'down';
  const accepted = Boolean(settings.data?.sourceTermsAcceptedAt);

  const statusColor =
    health === 'connected' ? 'bg-emerald-400' : health === 'stale' ? 'bg-amber-400' : 'bg-rose-500';
  const statusText =
    health === 'connected' ? 'Connected' : health === 'stale' ? 'Stale' : 'Not connected';

  const [rawStatus, setRawStatus] = useState<Record<string, unknown> | null>(null);
  const testConnection = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/status');
      return res.json();
    },
    onSuccess: (data) => setRawStatus(data),
    onError: (e) => setRawStatus({ error: e instanceof Error ? e.message : String(e) }),
  });

  const seedMatch = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/seed-match', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Test match data seeded', kind: 'success' });
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['provider'] });
    },
    onError: () => toast({ title: 'Could not seed test data', kind: 'error' }),
  });

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center space-y-6">
      <div className="text-center">
        <h1 className="mb-1 font-heading text-2xl font-bold text-slate-900">
          Chrome Extension
        </h1>
        <p className="text-sm text-slate-600">
          Pair the extension to stream live match data from Cricbuzz or Crex pages you have open.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
        <span className={clsx('size-3 rounded-full', statusColor)} />
        <span className="font-semibold text-blue-950">{statusText}</span>
        {provider.data?.extensionVersion && (
          <span className="text-xs text-slate-500">v{provider.data.extensionVersion}</span>
        )}
        {provider.data?.selectorsVersion !== null && provider.data?.selectorsVersion !== undefined && (
          <span className="text-xs text-slate-500">selectors v{provider.data.selectorsVersion}</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
            Test API
          </Button>
          <Button variant="secondary" onClick={() => seedMatch.mutate()} disabled={seedMatch.isPending}>
            Seed Test Data
          </Button>
        </div>
      </div>

      {rawStatus && (
        <div className="w-full rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Raw Status Response</h3>
          <pre className="mt-2 text-xs text-slate-700 overflow-x-auto">
            {JSON.stringify(rawStatus, null, 2)}
          </pre>
        </div>
      )}

      {health !== 'connected' && (
        <Card className="w-full">
          <h2 className="font-heading text-lg font-semibold text-blue-950">Troubleshooting</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Open <code className="text-teal font-mono">chrome://extensions</code> in Chrome
            </li>
            <li>Find "StumpCast Studio Connector" and click <b>Reload</b> (circular arrow icon)</li>
            <li>
              Open the extension&apos;s options page and check if it shows{" "}
              <b>"Paired with StumpCast Studio"</b>
            </li>
            <li>
              If paired but admin still shows "Not connected", the extension service worker may be
              suspended. Click the <b>Service Worker</b> link on the extension card to wake it up.
            </li>
            <li>
              Make sure a Cricbuzz or Crex match page is open in Chrome (the extension only reads
              pages you have open)
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => window.open('chrome://extensions', '_blank')}
            >
              Open chrome://extensions
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open('chrome://serviceworker-internals', '_blank')}
            >
              Open Service Worker Internals
            </Button>
          </div>
        </Card>
      )}

      {health !== 'connected' && (
        <Card className="w-full">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Connect the extension</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              In Chrome open <code className="text-blue-700 font-mono">chrome://extensions</code>, turn on{' '}
              <b>Developer mode</b> and choose <b>Load unpacked</b>, then select the StumpCast{' '}
              <code className="text-blue-700 font-mono">extension</code> folder.
            </li>
            <li>
              The extension connects <b>automatically (1-Click Auto Connect)</b> to StumpCast Studio on localhost. No manual pair code is needed.
            </li>
            <li>
              Open a live match page on Cricbuzz or Crex in Chrome to automatically stream real-time scores into Studio.
            </li>
          </ol>

          <label className="mt-4 flex max-w-2xl items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              disabled={!settings.data || saveSettings.isPending || accepted}
              onChange={async (event) => {
                if (!event.currentTarget.checked) return;
                try {
                  const response = await fetch('/api/ext/terms/accept', { method: 'POST' });
                  if (!response.ok) throw new Error('Could not record acceptance');
                  const result = (await response.json()) as { acceptedAt: number };
                  if (settings.data) {
                    qc.setQueryData(['settings'], {
                      ...settings.data,
                      sourceTermsAcceptedAt: result.acceptedAt,
                    });
                  }
                } catch {
                  toast({ title: 'Could not save the notice acceptance', kind: 'error' });
                }
              }}
            />
            <span className="text-slate-700">
              I understand that the extension reads only match pages I open. I am responsible for
              complying with the source site&apos;s terms of use; StumpCast does not host or resell
              source data.
            </span>
          </label>
        </Card>
      )}

      {health === 'connected' && (
        <Card className="w-full">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Data Feed Status</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {provider.data?.openTabs ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Open Tabs</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {matches.data?.length ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Matches</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {provider.data?.lastHeartbeatAt
                  ? `${Math.max(0, Math.round((Date.now() - provider.data.lastHeartbeatAt) / 1000))}s ago`
                  : '—'}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Last Heartbeat</div>
            </div>
          </div>

          {provider.data?.openTabs !== undefined && provider.data.openTabs > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
              Data is being fetched from {provider.data.openTabs} tab(s)
            </div>
          )}

          {provider.data?.lastDegraded && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-medium">
              Adapter degraded: {provider.data.lastDegraded.site} — missing:{' '}
              {provider.data.lastDegraded.missing.join(', ')} (
              {new Date(provider.data.lastDegraded.at).toLocaleTimeString()})
            </div>
          )}
        </Card>
      )}

      {(health === 'connected' || health === 'stale' || (matches.data && matches.data.length > 0)) && (
        <Card className="w-full">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Your Matches</h2>
          {matches.data && matches.data.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {matches.data.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-blue-200 bg-white px-3 py-2"
                >
                  <div>
                    <span className="truncate text-sm text-slate-900 font-medium">
                      {m.title} · {m.score.runs}-{m.score.wkts}
                    </span>
                    <span
                      className={`ml-2 size-2 rounded-full inline-block ${
                        provider.data?.matches.find((pm) => pm.matchId === m.id)?.health === 'connected'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>
                  {settings.data?.onStreamMatchId === m.id ? (
                    <span className="text-sm font-semibold text-emerald-400">On Stream</span>
                  ) : (
                    <Button
                      disabled={!settings.data}
                      onClick={() =>
                        saveSettings.mutate({ ...settings.data!, onStreamMatchId: m.id })
                      }
                    >
                      Put on stream
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No matches detected yet. Open a Cricbuzz or Crex match page in Chrome.
            </p>
          )}

          <div className="mt-4 border-t border-blue-100 pt-4">
            <h3 className="text-sm font-semibold text-blue-950">Open a match by URL</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://www.cricbuzz.com/live-cricket-scores/..."
                className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
              <Button
                disabled={!urlDraft.trim() || openMatch.isPending}
                onClick={() => openMatch.mutate(urlDraft.trim())}
              >
                Open
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Button variant="ghost" onClick={() => navigate('/setup')}>
        Back to setup wizard
      </Button>
    </div>
  );
};
