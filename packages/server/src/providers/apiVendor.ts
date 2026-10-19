import type { RawUpdate, MatchSummary } from '@stumpcast/shared';

export interface ApiVendorAdapter {
  vendor: string;
  baseUrl: string;
  fetchLiveScore(apiKey: string, matchId: string, fetchFn?: typeof fetch, etag?: string): Promise<{ data: unknown; etag?: string }>;
  listMatches(apiKey: string, fetchFn?: typeof fetch): Promise<MatchSummary[]>;
  mapPayload(rawVendorPayload: unknown, matchId: string, now?: number): RawUpdate;
}

/**
 * Standard Cricket Data API vendor adapter.
 * Supports official JSON fixtures and live endpoints.
 */
export class CricketDataApiVendor implements ApiVendorAdapter {
  readonly vendor = 'cricketdata';
  readonly baseUrl: string;

  constructor(baseUrl = 'https://api.cricapi.com/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async listMatches(apiKey: string, fetchFn: typeof fetch = fetch): Promise<MatchSummary[]> {
    const res = await fetchFn(`${this.baseUrl}/matches?apikey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(`Vendor API listMatches failed: ${res.status}`);
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const list = json.data ?? [];
    return list.map((m) => {
      const matchId = String(m.id ?? m.matchId ?? 'match');
      const title = String(m.name ?? m.title ?? matchId);
      const teams = Array.isArray(m.teams) ? (m.teams as string[]) : [];
      const status = m.status ? String(m.status) : undefined;
      return {
        matchId,
        title,
        teams,
        status,
        source: 'cricbuzz' as const,
      };
    });
  }

  async fetchLiveScore(
    apiKey: string,
    matchId: string,
    fetchFn: typeof fetch = fetch,
    etag?: string,
  ): Promise<{ data: unknown; etag?: string }> {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;

    const res = await fetchFn(
      `${this.baseUrl}/match_scorecard?apikey=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(matchId)}`,
      { headers },
    );

    if (res.status === 304) {
      return { data: null, etag };
    }
    if (!res.ok) {
      const err = new Error(`Vendor HTTP Error ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }

    const nextEtag = res.headers.get('etag') ?? undefined;
    const json = await res.json();
    return { data: json, etag: nextEtag };
  }

  mapPayload(raw: unknown, matchId: string, now: number = Date.now()): RawUpdate {
    if (!raw || typeof raw !== 'object') {
      return {
        source: 'api',
        matchId,
        url: `${this.baseUrl}/match_scorecard?id=${matchId}`,
        capturedAt: now,
        confidence: 0,
        fields: {
          teams: [],
          innings: [],
          batters: [],
          thisOver: [],
          lastBalls: [],
        },
        missing: ['innings', 'score'],
      };
    }

    const obj = raw as Record<string, unknown>;
    const data = (obj.data && typeof obj.data === 'object' ? obj.data : obj) as Record<string, unknown>;
    const title = data.name ? String(data.name) : data.title ? String(data.title) : undefined;
    const status = data.status ? String(data.status) : undefined;
    const venue = data.venue ? String(data.venue) : undefined;

    const rawTeams = Array.isArray(data.teams) ? (data.teams as string[]) : [];
    const teams = rawTeams.map((t) => ({ name: String(t) }));

    const rawScore = Array.isArray(data.score) ? (data.score as Array<Record<string, unknown>>) : [];
    const innings: RawUpdate['fields']['innings'] = [];

    for (const sc of rawScore) {
      const r = typeof sc.r === 'number' ? sc.r : typeof sc.runs === 'number' ? sc.runs : 0;
      const w = typeof sc.w === 'number' ? sc.w : typeof sc.wkts === 'number' ? sc.wkts : 0;
      const rawOvers = typeof sc.o === 'number' ? sc.o : typeof sc.overs === 'number' ? sc.overs : 0;
      const overs = Math.floor(rawOvers);
      const ballsFloat = (rawOvers - overs) * 10;
      const balls = Math.min(5, Math.round(ballsFloat));
      innings.push({
        team: sc.inning ? String(sc.inning) : (teams[0]?.name ?? ''),
        runs: r,
        wkts: w,
        overs,
        balls,
      });
    }

    const batters: RawUpdate['fields']['batters'] = [];
    const rawBatters = Array.isArray(data.batting) ? (data.batting as Array<Record<string, unknown>>) : [];
    for (const b of rawBatters.slice(0, 2)) {
      const name = String(b.batsman ?? b.name ?? '');
      if (name) {
        batters.push({
          name,
          runs: typeof b.r === 'number' ? b.r : 0,
          balls: typeof b.b === 'number' ? b.b : 0,
          fours: typeof b['4s'] === 'number' ? b['4s'] : undefined,
          sixes: typeof b['6s'] === 'number' ? b['6s'] : undefined,
          onStrike: Boolean(b.onStrike),
        });
      }
    }

    let bowler: RawUpdate['fields']['bowler'];
    const rawBowling = Array.isArray(data.bowling) ? (data.bowling as Array<Record<string, unknown>>) : [];
    const firstBowler = rawBowling[0];
    if (firstBowler) {
      const bOvers = typeof firstBowler.o === 'number' ? firstBowler.o : 0;
      const bOversInt = Math.floor(bOvers);
      bowler = {
        name: String(firstBowler.bowler ?? firstBowler.name ?? 'Bowler'),
        overs: bOversInt,
        balls: Math.min(5, Math.round((bOvers - bOversInt) * 10)),
        runs: typeof firstBowler.r === 'number' ? firstBowler.r : 0,
        wkts: typeof firstBowler.w === 'number' ? firstBowler.w : 0,
        maidens: typeof firstBowler.m === 'number' ? firstBowler.m : 0,
      };
    }

    const missing: string[] = [];
    if (innings.length === 0) missing.push('innings');
    if (!status) missing.push('status');

    return {
      source: 'api',
      matchId,
      url: `${this.baseUrl}/match_scorecard?id=${matchId}`,
      capturedAt: now,
      confidence: missing.length === 0 ? 1.0 : innings.length > 0 ? 0.8 : 0.2,
      fields: {
        title,
        status,
        venue,
        teams,
        innings,
        batters,
        bowler,
        thisOver: [],
        lastBalls: [],
      },
      missing,
    };
  }
}
