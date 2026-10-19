import { useCallback, useMemo, useState, type CSSProperties } from 'react';

type PlanType = 'monthly' | 'yearly' | 'lifetime';

interface GeneratedKey {
  token: string;
  channel: string;
  plan: PlanType;
  days: number;
  expiresAt: number | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PLANS: { value: PlanType; label: string; icon: string; desc: string }[] = [
  { value: 'monthly', label: 'Monthly', icon: '\u{1F4C5}', desc: '31 days' },
  { value: 'yearly', label: 'Yearly', icon: '\u{1F4C5}', desc: '366 days' },
  { value: 'lifetime', label: 'Lifetime', icon: '\u{2B50}', desc: 'Never expires' },
];

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#f1f5f9', color: '#0f172a', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px' },
  container: { maxWidth: '720px', margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: '32px' },
  title: { fontSize: '28px', fontWeight: 800, margin: 0 },
  titleSpan: { color: '#f97316' },
  subtitle: { color: '#64748b', fontSize: '14px', marginTop: '4px' },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' },
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  planIcon: { fontSize: '24px' },
  planName: { fontSize: '14px', fontWeight: 600 },
  planDesc: { fontSize: '11px', color: '#64748b' },
  dateGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  dateLabel: { display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' },
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#fff' },
  infoBox: { background: '#dbeafe', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: '#1e40af' },
  resultCard: { background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '14px', padding: '24px', marginTop: '20px', textAlign: 'center' },
  resultLabel: { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a', marginBottom: '12px' },
  resultToken: { fontFamily: "'Consolas', 'Courier New', monospace", fontSize: '14px', fontWeight: 600, wordBreak: 'break-all', lineHeight: '1.7', padding: '16px', background: '#fff', borderRadius: '10px', border: '1px solid #86efac', marginBottom: '16px' },
  copyBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  resultInfo: { fontSize: '12px', color: '#64748b', marginTop: '12px', lineHeight: '1.8' },
  helpCard: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' },
  helpTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '12px' },
  helpList: { paddingLeft: '20px', fontSize: '13px', color: '#64748b', lineHeight: '1.8' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: '#dc2626', marginBottom: '16px' },
};

const planLabelStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '16px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  border: active ? '2px solid #f97316' : '2px solid #e2e8f0',
  background: active ? '#fff7ed' : '#f8fafc',
  textAlign: 'center',
});

const btnStyle = (loading: boolean): CSSProperties => ({
  width: '100%',
  padding: '12px',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: loading ? 'not-allowed' : 'pointer',
  background: loading ? '#94a3b8' : '#f97316',
  color: '#fff',
});

export function LicenseGenerator() {
  const now = useMemo(() => new Date(), []);
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
    if (!trimmed) { setError('Please enter a channel handle.'); return; }
    if (trimmed.length > 100) { setError('Channel handle too long (max 100 characters).'); return; }
    if (plan !== 'lifetime' && daysRemaining <= 0) { setError('Expiry date must be in the future.'); return; }

    setLoading(true);
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/licence/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: trimmed, plan, ...(plan !== 'lifetime' ? { days: daysRemaining } : {}) }),
      });
      const data = await resp.json() as GeneratedKey & { error?: string };
      if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
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
    } catch { /* clipboard unavailable */ }
  }, [result]);

  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const months = MONTHS;
  const years = useMemo(() => Array.from({ length: 11 }, (_, i) => now.getFullYear() + i), [now]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>
            StumpCast <span style={S.titleSpan}>Studio</span>
          </h1>
          <p style={S.subtitle}>License Key Generator &mdash; Admin Tool</p>
        </header>

        <div style={S.card}>
          {error && <div style={S.error}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={S.label}>Channel / Handle</label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="@channelname"
                maxLength={100}
                style={S.input}
              />
            </div>

            <div>
              <label style={S.label}>Plan Type</label>
              <div style={S.planGrid}>
                {PLANS.map((p) => (
                  <label key={p.value} style={planLabelStyle(plan === p.value)}>
                    <input type="radio" name="plan" value={p.value} checked={plan === p.value} onChange={() => setPlan(p.value)} style={{ display: 'none' }} />
                    <span style={S.planIcon}>{p.icon}</span>
                    <span style={S.planName}>{p.label}</span>
                    <span style={S.planDesc}>{p.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ opacity: plan === 'lifetime' ? 0.4 : 1, pointerEvents: plan === 'lifetime' ? 'none' : 'auto' }}>
              <label style={S.label}>Expiry Date</label>
              <div style={S.dateGrid}>
                <div>
                  <label style={S.dateLabel}>Day</label>
                  <select value={expDay} onChange={(e) => setExpDay(Number(e.target.value))} style={S.select}>
                    {days.map((d) => <option key={d} value={d}>{String(d).padStart(2, '0')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.dateLabel}>Month</label>
                  <select value={expMonth} onChange={(e) => setExpMonth(Number(e.target.value))} style={S.select}>
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.dateLabel}>Year</label>
                  <select value={expYear} onChange={(e) => setExpYear(Number(e.target.value))} style={S.select}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {plan !== 'lifetime' && <div style={S.infoBox}>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</div>}
            {plan === 'lifetime' && <div style={S.infoBox}>Lifetime &mdash; never expires</div>}

            <button type="button" onClick={handleGenerate} disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Generating...' : 'Generate License Key'}
            </button>
          </div>
        </div>

        {result && (
          <div style={S.resultCard}>
            <div style={S.resultLabel}>License Key Generated</div>
            <div style={S.resultToken}>{result.token}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <button type="button" onClick={handleCopy} style={S.copyBtn}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <div style={S.resultInfo}>
                <strong>Channel:</strong> {result.channel} | <strong>Plan:</strong> {result.plan} |{' '}
                <strong>Expires:</strong>{' '}
                {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never'}
              </div>
            </div>
          </div>
        )}

        <div style={S.helpCard}>
          <h2 style={S.helpTitle}>How It Works</h2>
          <ol style={S.helpList}>
            <li>Enter the channel handle the licence is bound to.</li>
            <li>Select a plan type: Monthly, Yearly, or Lifetime.</li>
            <li>For Monthly/Yearly: pick the expiry date using day/month/year selectors.</li>
            <li>For Lifetime: no expiry &mdash; the key never expires.</li>
            <li>Click Generate &mdash; a signed SC1 token is produced.</li>
            <li>Send the key to the user. They paste it into StumpCast Studio&apos;s licence dialog.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
