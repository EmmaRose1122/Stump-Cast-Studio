import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { generateLicenseKey, type GeneratedKey, type PlanType } from '../lib/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PLANS: { value: PlanType; label: string; icon: string; desc: string }[] = [
  { value: 'monthly', label: 'Monthly', icon: '\u{1F4C5}', desc: '31 days' },
  { value: 'yearly', label: 'Yearly', icon: '\u{1F4C5}', desc: '366 days' },
  { value: 'lifetime', label: 'Lifetime', icon: '⭐', desc: 'Never expires' },
];

function buildDateOptions() {
  const now = new Date();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 11 }, (_, i) => now.getFullYear() + i);
  return { days, months: MONTHS, years, now };
}

function Field({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={clsx(disabled && 'opacity-40 pointer-events-none')}>
      <label className="mb-1.5 block text-sm font-semibold text-text">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text transition focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20';

export function LicenseGenerator() {
  const { days, months, years, now } = useMemo(buildDateOptions, []);
  const [channel, setChannel] = useState('');
  const [plan, setPlan] = useState<PlanType>('monthly');
  const [expDay, setExpDay] = useState(now.getDate());
  const [expMonth, setExpMonth] = useState(now.getMonth());
  const [expYear, setExpYear] = useState(now.getFullYear() + 1);
  const [result, setResult] = useState<GeneratedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const daysRemaining = useMemo(() => {
    const selected = new Date(expYear, expMonth, expDay);
    const diff = selected.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, [expDay, expMonth, expYear, now]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setResult(null);

    const trimmed = channel.trim();
    if (!trimmed) {
      setError('Please enter a channel handle.');
      return;
    }
    if (trimmed.length > 100) {
      setError('Channel handle too long (max 100 characters).');
      return;
    }
    if (plan !== 'lifetime' && daysRemaining <= 0) {
      setError('Expiry date must be in the future.');
      return;
    }

    setLoading(true);
    try {
      const data = await generateLicenseKey({
        channel: trimmed,
        plan,
        ...(plan !== 'lifetime' ? { days: daysRemaining } : {}),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key.');
    } finally {
      setLoading(false);
    }
  }, [channel, plan, daysRemaining]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result.token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const formatExpiry = (ms: number | null) => {
    if (ms === null) return 'Never expires (Lifetime)';
    return new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-text">
            StumpCast <span className="text-coral">Studio</span>
          </h1>
          <p className="mt-1 text-sm text-muted">License Key Generator &mdash; Admin Tool</p>
        </header>

        <div className="rounded-card border border-border bg-surface p-6 shadow-sm animate-fade-in">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-[10px] border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            >
              {error}
            </div>
          )}

          <div className="space-y-5">
            <Field label="Channel / Handle">
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="@channelname"
                maxLength={100}
                className={inputCls}
              />
            </Field>

            <Field label="Plan Type">
              <div className="grid grid-cols-3 gap-3">
                {PLANS.map((p) => (
                  <label
                    key={p.value}
                    className={clsx(
                      'flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 px-3 py-4 text-center transition',
                      plan === p.value
                        ? 'border-teal bg-teal/10'
                        : 'border-border bg-surface-2 hover:border-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={p.value}
                      checked={plan === p.value}
                      onChange={() => setPlan(p.value)}
                      className="sr-only"
                    />
                    <span className="text-2xl" aria-hidden>
                      {p.icon}
                    </span>
                    <span className="text-sm font-semibold text-text">{p.label}</span>
                    <span className="text-[11px] text-muted">{p.desc}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Expiry Date" disabled={plan === 'lifetime'}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Day</label>
                  <select
                    value={expDay}
                    onChange={(e) => setExpDay(Number(e.target.value))}
                    className={inputCls}
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {String(d).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Month</label>
                  <select
                    value={expMonth}
                    onChange={(e) => setExpMonth(Number(e.target.value))}
                    className={inputCls}
                  >
                    {months.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Year</label>
                  <select
                    value={expYear}
                    onChange={(e) => setExpYear(Number(e.target.value))}
                    className={inputCls}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Field>

            {plan !== 'lifetime' && (
              <div className="rounded-[10px] bg-ok/10 px-4 py-3 text-center text-sm font-semibold text-ok">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
              </div>
            )}

            {plan === 'lifetime' && (
              <div className="rounded-[10px] bg-ok/10 px-4 py-3 text-center text-sm font-semibold text-ok">
                Lifetime &mdash; never expires
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className={clsx(
                'w-full rounded-[10px] py-3 text-sm font-bold transition',
                loading
                  ? 'cursor-not-allowed bg-muted text-text'
                  : 'bg-coral text-coral-ink hover:opacity-90 pulse-ring',
              )}
            >
              {loading ? 'Generating...' : 'Generate License Key'}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-6 rounded-card border border-teal/30 bg-surface p-6 shadow-sm animate-fade-in">
            <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-teal">
              License Key Generated
            </h2>
            <div className="mb-4 break-all rounded-[10px] border border-border bg-surface-2 p-4 font-mono text-sm leading-relaxed text-text">
              {result.token}
            </div>
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-[10px] bg-ok px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <div className="text-center text-xs text-muted">
                <p>
                  <strong className="text-text">Channel:</strong> {result.channel}
                  {' | '}
                  <strong className="text-text">Plan:</strong> {result.plan}
                  {' | '}
                  <strong className="text-text">Expires:</strong> {formatExpiry(result.expiresAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-card border border-border bg-surface p-6">
          <h2 className="mb-3 font-heading text-base font-bold text-text">How It Works</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Enter the channel handle the licence is bound to.</li>
            <li>Select a plan type: Monthly, Yearly, or Lifetime.</li>
            <li>For Monthly/Yearly: pick the expiry date using day/month/year selectors.</li>
            <li>For Lifetime: no expiry &mdash; the key never expires.</li>
            <li>
              Click <strong className="text-text">Generate</strong> &mdash; a signed{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-teal">SC1</code> token
              is produced.
            </li>
            <li>Send the key to the user. They paste it into StumpCast Studio&apos;s licence dialog.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
