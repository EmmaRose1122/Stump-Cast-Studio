import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { api, useServerOrigin } from '../lib/api';
import { navigate } from '../lib/router';
import {
  OBS_SETTINGS,
  currentStep,
  extensionHasData,
  overlayUrl,
  readLocal,
  resetLocal,
  wizardSteps,
  writeLocal,
  type StepId,
  type WizardLocal,
} from '../lib/wizard';
import { useAdmin } from '../store';
import { Banner, Button, Card } from '../ui';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const Check = ({ done, n }: { done: boolean; n: number }) => (
  <span
    className={clsx(
      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
      done ? 'bg-ok text-bg' : 'border border-border text-muted',
    )}
    aria-label={done ? 'done' : `step ${n}`}
  >
    {done ? '✓' : n}
  </span>
);
export const SetupPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const [local, setLocal] = useState<WizardLocal>(() => readLocal());
  const [open, setOpen] = useState<StepId | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const provider = useQuery({
    queryKey: ['provider'],
    queryFn: api.providerStatus,
    refetchInterval: 2000,
  });
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 2000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });

  const update = (patch: Partial<WizardLocal>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    writeLocal(next);
  };

  const steps = wizardSteps({
    provider: provider.data,
    matches: matches.data ?? [],
    settings: settings.data,
    ...local,
  });
  const active = open ?? steps[currentStep(steps)]!.id;
  const allDone = steps.every((s) => s.done);

  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => qc.setQueryData(['settings'], s),
    onError: () => toast({ title: 'Could not save', kind: 'error' }),
  });

  // OBS must be pointed at the server's own port: the packaged app moves off 4000 when a dev
  // stack is already running, and this page is often served by vite (5175), which has no overlay.
  const origin = useServerOrigin();
  const url = overlayUrl(origin);
  const previewOverlayUrl =
    location.port === '5175' ? 'http://127.0.0.1:5174/' : `${origin}/overlay/`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      update({ linkCopied: true });
      toast({ title: 'Overlay link copied', kind: 'success' });
    } catch {
      update({ linkCopied: true });
      toast({ title: 'Copy it manually from the box', kind: 'info' });
    }
  };

  const finish = async () => {
    if (settings.data) await save.mutateAsync({ ...settings.data, setupComplete: true });
    try {
      sessionStorage.setItem('stumpcast.setup.dismissed', '1');
    } catch {
      /* ignore */
    }
    navigate('/live');
  };

  const skip = () => {
    try {
      sessionStorage.setItem('stumpcast.setup.dismissed', '1');
    } catch {
      /* ignore */
    }
    navigate('/live');
  };

  const body = (id: StepId) => {
    if (id === 'source') {
      return (
        <div className="grid gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              In Chrome open <code>chrome://extensions</code>, turn on <b>Developer mode</b> and
              choose <b>Load unpacked</b>, then pick the StumpCast extension folder.
            </li>
            <li>
              The extension connects <b>automatically (1-Click Auto Connect)</b> to StumpCast Studio. No manual pair code is needed.
            </li>
          </ol>
          <label className="flex max-w-2xl items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={Boolean(settings.data?.sourceTermsAcceptedAt)}
              disabled={!settings.data || save.isPending || Boolean(settings.data.sourceTermsAcceptedAt)}
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
            <span>
              I understand that the extension reads only match pages I open. I am responsible for
              complying with the source site&apos;s terms of use; StumpCast does not host or resell
              source data.
            </span>
          </label>
          <p className="text-sm">
            Then open a Cricbuzz or Crex match page in the same browser. This step ticks itself when
            scores start arriving.
          </p>
          <p aria-live="polite" className="text-sm">
            {extensionHasData(provider.data)
              ? '✓ Receiving data from the extension'
              : provider.data?.lastHeartbeatAt
                ? 'Extension connected. Waiting for a match page…'
                : 'Waiting for the extension…'}
          </p>
          <div>
            <button
              type="button"
              className="text-sm text-teal underline"
              aria-expanded={showOthers}
              onClick={() => setShowOthers((v) => !v)}
            >
              Other sources
            </button>
            {showOthers && (
              <div className="mt-2 grid gap-2 rounded-[10px] border border-border p-3 text-sm">
                <p>No data feed? Score the match yourself, ball by ball, from the Live tab.</p>
                <Button
                  className="w-fit"
                  onClick={() => {
                    update({ manualChosen: true });
                    navigate('/live');
                  }}
                >
                  Use manual scoring
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (id === 'match') {
      const list = matches.data ?? [];
      return (
        <div className="grid gap-3">
          {list.length === 0 ? (
            <p className="text-sm text-muted">
              No match yet. Open a match page with the extension, or create a manual match on the
              Live tab.
            </p>
          ) : (
            <ul className="grid gap-2">
              {list.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2"
                >
                  <span className="truncate">
                    {m.title && m.title.includes('vs')
                      ? m.title
                      : m.teams[0]?.name && m.teams[1]?.name
                        ? `${m.teams[0].name} vs ${m.teams[1].name}${m.title ? ` (${m.title})` : ''}`
                        : m.title} · {m.score.runs}-{m.score.wkts}
                    {m.score.overs > 0 || m.score.balls > 0 ? ` (${m.score.overs}.${m.score.balls} ov)` : ''}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {settings.data?.onStreamMatchId === m.id ? (
                      <span className="text-sm font-semibold text-ok">✓ Selected</span>
                    ) : (
                      <Button
                        disabled={!settings.data}
                        onClick={() => save.mutate({ ...settings.data!, onStreamMatchId: m.id })}
                      >
                        Use this match
                      </Button>
                    )}
                    <button
                      type="button"
                      title="Delete this match"
                      onClick={async () => {
                        try {
                          await api.deleteMatch(m.id);
                          await qc.invalidateQueries({ queryKey: ['matches'] });
                          await qc.invalidateQueries({ queryKey: ['settings'] });
                          toast({ title: `Deleted ${m.title}`, kind: 'success' });
                        } catch (err) {
                          toast({ title: errorText(err), kind: 'error' });
                        }
                      }}
                      className="p-1.5 text-xs text-muted hover:text-red-400 hover:bg-red-950/30 rounded transition"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button className="w-fit" onClick={() => navigate('/live')}>
              Create a manual match
            </Button>
            {list.length > 0 && (
              <Button
                variant="danger"
                className="w-fit"
                onClick={async () => {
                  try {
                    await api.clearMatches();
                    await qc.invalidateQueries({ queryKey: ['matches'] });
                    await qc.invalidateQueries({ queryKey: ['settings'] });
                    toast({ title: 'All test matches cleared', kind: 'success' });
                  } catch (err) {
                    toast({ title: errorText(err), kind: 'error' });
                  }
                }}
              >
                Clear all matches
              </Button>
            )}
          </div>
        </div>
      );
    }
    if (id === 'preview') {
      const mid = settings.data?.onStreamMatchId;
      return (
        <div className="grid gap-3">
          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-[10px] border border-border bg-[repeating-conic-gradient(var(--color-surface-2)_0_25%,var(--color-bg)_0_50%)] bg-[length:24px_24px]">
            <iframe
              title="Overlay preview"
              className="size-full border-0"
              src={`${previewOverlayUrl}?preview=1${mid ? `&match=${encodeURIComponent(mid)}` : ''}`}
            />
          </div>
          <Button
            className="w-fit"
            variant={local.previewConfirmed ? 'secondary' : 'primary'}
            onClick={() => update({ previewConfirmed: true })}
          >
            {local.previewConfirmed ? '✓ Looks right' : 'This looks right'}
          </Button>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Overlay link
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full max-w-xl rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
          />
        </label>
        <Button variant="primary" className="w-fit" onClick={() => void copy()}>
          {local.linkCopied ? '✓ Copied. Copy again' : 'Copy link'}
        </Button>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            In OBS, under <b>Sources</b>, click <b>+</b> and choose <b>Browser</b>.
          </li>
          <li>
            Paste the link into <b>URL</b>. Set <b>Width</b> {OBS_SETTINGS.width} and <b>Height</b>{' '}
            {OBS_SETTINGS.height}.
          </li>
          <li>
            Leave the custom CSS empty and untick <b>Shutdown source when not visible</b> so the
            overlay keeps running.
          </li>
          <li>Place the source above your video and you are live.</li>
        </ol>
        <div>
          <Button disabled title="Available once OBS WebSocket control is connected">
            Test in OBS
          </Button>
          <p className="mt-1 text-xs text-muted">
            One-click setup needs OBS WebSocket control, which arrives in the Video &amp; Cams
            build.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center">
      <h1 className="mb-1 font-heading text-2xl font-bold text-white">Set up your stream</h1>
      <p className="mb-6 text-sm text-slate-300">
        Four quick steps. Each one ticks itself when it is done.
      </p>

      <div className="grid gap-3 w-full text-left">
        {steps.map((s, i) => {
          const isOpen = s.id === active;
          return (
            <Card key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.id)}
              >
                <Check done={s.done} n={i + 1} />
                <span className="font-heading text-lg font-semibold">{s.title}</span>
              </button>
              {isOpen && <div className="mt-4">{body(s.id)}</div>}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled={!allDone} onClick={() => void finish()}>
          Finish setup
        </Button>
        <Button variant="ghost" onClick={skip}>
          Skip for now
        </Button>
      </div>
      {!allDone && (
        <div className="mt-4">
          <Banner tone="info">
            Finish all four steps to complete setup, or skip and come back from Help.
          </Banner>
        </div>
      )}
    </div>
  );
};

export const reopenSetup = (): void => {
  resetLocal();
  try {
    sessionStorage.removeItem('stumpcast.setup.dismissed');
  } catch {
    /* ignore */
  }
  navigate('/setup');
};
