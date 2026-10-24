import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { useAdmin } from '../store'
import { Button, Card, Alert, Input, Label } from '../ui'

export const ExtensionPage = () => {
  const qc = useQueryClient()
  const toast = useAdmin((s) => s.toast)
  const [urlDraft, setUrlDraft] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [pairError, setPairError] = useState('')
  const [pairing, setPairing] = useState(false)

  const provider = useQuery({
    queryKey: ['provider'],
    queryFn: api.providerStatus,
    refetchInterval: 2000,
  })
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 })
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings })

  const saveSettings = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => qc.setQueryData(['settings'], s),
    onError: () => toast({ title: 'Could not save', kind: 'error' }),
  })

  const openMatch = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch('/api/ext/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: 'openMatch', url }),
      })
      if (!res.ok) throw new Error('Could not send command')
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Opening match page...', kind: 'success' })
      setUrlDraft('')
    },
    onError: () => toast({ title: 'Could not open match. Is the extension connected?', kind: 'error' }),
  })

  const pairCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/ext/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Invalid code' }))
        throw new Error(err.error ?? 'Invalid pairing code')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Extension paired successfully!', kind: 'success' })
      setPairCode('')
      setPairError('')
      void qc.invalidateQueries({ queryKey: ['provider'] })
    },
    onError: (e) => setPairError(e instanceof Error ? e.message : 'Pairing failed'),
  })

  const autoPairMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/auto-pair', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Auto-pair failed' }))
        throw new Error(err.error ?? 'Auto-pair failed')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Auto-paired with Studio!', kind: 'success' })
      void qc.invalidateQueries({ queryKey: ['provider'] })
    },
    onError: (e) => setPairError(e instanceof Error ? e.message : 'Auto-pair failed'),
  })

  const unpairMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/unpair', { method: 'POST' })
      if (!res.ok) throw new Error('Could not unpair')
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Extension unpaired', kind: 'info' })
      void qc.invalidateQueries({ queryKey: ['provider'] })
    },
    onError: () => toast({ title: 'Could not unpair', kind: 'error' }),
  })

  const testConnection = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/status')
      return res.json()
    },
    onSuccess: (data) => toast({ title: 'Connection test complete', kind: 'success' }),
    onError: (e) => toast({ title: 'Test failed', description: e instanceof Error ? e.message : String(e), kind: 'error' }),
  })

  const seedMatch = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ext/seed-match', { method: 'POST' })
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Test match data seeded', kind: 'success' })
      void qc.invalidateQueries({ queryKey: ['matches'] })
      void qc.invalidateQueries({ queryKey: ['provider'] })
    },
    onError: () => toast({ title: 'Could not seed test data', kind: 'error' }),
  })

  const health = provider.data?.health ?? 'down'
  const accepted = Boolean(settings.data?.sourceTermsAcceptedAt)

  const statusColor =
    health === 'connected' ? 'bg-emerald-400' : health === 'stale' ? 'bg-amber-400' : 'bg-rose-500'
  const statusText =
    health === 'connected' ? 'Connected' : health === 'stale' ? 'Stale' : 'Not connected'

  const [rawStatus, setRawStatus] = useState<Record<string, unknown> | null>(null)

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

      {/* Connection Status Banner */}
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
            Test Connection
          </Button>
          <Button variant="secondary" onClick={() => seedMatch.mutate()} disabled={seedMatch.isPending}>
            Seed Test Data
          </Button>
        </div>
      </div>

      {/* Pairing Section - Always visible with clear status */}
      <Card className="w-full">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Extension Pairing</h2>
        <div className="mt-3 space-y-4">

          {health === 'connected' ? (
            // Connected state - show unpair option
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-800">Extension Paired & Streaming</p>
                  <p className="text-sm text-emerald-700">
                    {provider.data?.openTabs ?? 0} tab(s) active · {matches.data?.length ?? 0} match(es) found
                  </p>
                </div>
              </div>
              <Button variant="danger" onClick={() => unpairMutation.mutate()} disabled={unpairMutation.isPending}>
                Unpair Extension
              </Button>
            </div>
          ) : (
            // Not connected - show pairing options
            <>
              <Alert variant="warning">
                <strong>Extension Not Connected</strong>
                <p className="text-sm text-slate-600 mt-1">
                  The Chrome extension is not paired with StumpCast Studio. Choose a pairing method below.
                </p>
              </Alert>

              {/* Auto-pair (recommended) */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-blue-950">⚡ 1-Click Auto Connect (Recommended)</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Automatically discovers StumpCast Studio on localhost and pairs instantly. No codes needed.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => autoPairMutation.mutate()}
                    disabled={autoPairMutation.isPending}
                  >
                    {autoPairMutation.isPending ? 'Connecting...' : 'Auto-Connect Now'}
                  </Button>
                </div>
              </div>

              {/* Manual pair code */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <p className="font-semibold text-amber-950 mb-2">🔐 Manual Pair Code</p>
                <p className="text-sm text-amber-700 mb-3">
                  Use this if auto-connect fails. Get a 6-digit code from the extension options page.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={pairCode}
                    onChange={(e) => { setPairCode(e.target.value.toUpperCase()); setPairError('') }}
                    placeholder="123456"
                    maxLength={6}
                    className="flex-1 min-w-[120px] text-center text-lg font-mono tracking-widest"
                    disabled={pairing}
                  />
                  <Button
                    variant="primary"
                    onClick={() => { setPairing(true); pairCodeMutation.mutate(pairCode) }}
                    disabled={pairing || !pairCode.trim() || pairCodeMutation.isPending}
                  >
                    {pairCodeMutation.isPending ? 'Pairing...' : 'Pair with Code'}
                  </Button>
                </div>
                {pairError && (
                  <Alert variant="error" className="mt-3">
                    {pairError}
                  </Alert>
                )}
              </div>

              {/* Troubleshooting */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="font-semibold text-slate-950 mb-2">🛠 Troubleshooting</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Open <code className="text-teal font-mono">chrome://extensions</code> in Chrome</li>
                  <li>Find "StumpCast Studio Connector" and click <b>Reload</b> (circular arrow icon)</li>
                  <li>Open the extension&apos;s options page (click "Extension options") and check if it shows <b>"Paired with StumpCast Studio"</b></li>
                  <li>If paired but admin shows "Not connected", the service worker may be suspended. Click the <b>Service Worker</b> link on the extension card to wake it up.</li>
                  <li>Make sure a Cricbuzz or Crex <b>live match page</b> is open in Chrome (the extension only reads pages you have open)</li>
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => window.open('chrome://extensions', '_blank')}>
                    Open chrome://extensions
                  </Button>
                  <Button variant="secondary" onClick={() => window.open('chrome://serviceworker-internals', '_blank')}>
                    Open Service Worker Internals
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Source Terms Acceptance */}
          {!accepted && settings.data && (
            <Label className="flex max-w-2xl items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                disabled={!settings.data || saveSettings.isPending}
                onChange={async (event) => {
                  if (!event.currentTarget.checked) return
                  try {
                    const response = await fetch('/api/ext/terms/accept', { method: 'POST' })
                    if (!response.ok) throw new Error('Could not record acceptance')
                    const result = (await response.json()) as { acceptedAt: number }
                    if (settings.data) {
                      qc.setQueryData(['settings'], {
                        ...settings.data,
                        sourceTermsAcceptedAt: result.acceptedAt,
                      })
                    }
                  } catch {
                    toast({ title: 'Could not save the notice acceptance', kind: 'error' })
                  }
                }}
              />
              <span className="text-slate-700">
                I understand that the extension reads only match pages I open. I am responsible for
                complying with the source site&apos;s terms of use; StumpCast does not host or resell
                source data.
              </span>
            </Label>
          )}
        </div>
      </Card>

      {/* Data Feed Status - Connected only */}
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

      {/* Your Matches - shown when connected, stale, or matches exist */}
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
                      {(() => {
                        if (m.title && m.title.includes('vs')) return m.title
                        if (m.teams[0]?.name && m.teams[1]?.name) {
                          return `${m.teams[0].name} vs ${m.teams[1].name}${m.title ? ` (${m.title})` : ''}`
                        }
                        return m.title
                      })()} · {m.score.runs}-{m.score.wkts}
                      {m.score.overs > 0 || m.score.balls > 0 ? ` (${m.score.overs}.${m.score.balls} ov)` : ''}
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
  )
}