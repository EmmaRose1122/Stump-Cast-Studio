export type PlanType = 'monthly' | 'yearly' | 'lifetime';

export interface GenerateRequest {
  channel: string;
  plan: PlanType;
  days?: number;
}

export interface GeneratedKey {
  token: string;
  channel: string;
  plan: PlanType;
  days: number;
  expiresAt: number | null;
}

export interface ApiError {
  error: string;
}

const BASE = window.location.origin;

export async function generateLicenseKey(req: GenerateRequest): Promise<GeneratedKey> {
  const resp = await fetch(`${BASE}/api/licence/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = (await resp.json()) as GeneratedKey & ApiError;
  if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
  return data;
}
