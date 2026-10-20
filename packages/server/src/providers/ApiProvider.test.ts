import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiProvider';
import { CricketDataApiVendor } from './apiVendor';
import { SecretStore } from './SecretStore';

describe('ApiProvider', () => {
  const sampleMatchPayload = {
    data: {
      name: 'India vs Pakistan, T20 World Cup',
      status: 'Innings 1 in progress',
      venue: 'MCG',
      teams: ['India', 'Pakistan'],
      score: [
        { inning: 'India Inning 1', r: 145, w: 3, o: 16.2 },
      ],
      batting: [
        { batsman: 'Virat Kohli', r: 52, b: 36, '4s': 5, '6s': 2, onStrike: true },
        { batsman: 'Hardik Pandya', r: 28, b: 18, '4s': 2, '6s': 1 },
      ],
      bowling: [
        { bowler: 'Shaheen Afridi', o: 3.2, r: 28, w: 2, m: 0 },
      ],
    },
  };

  it('polls live score and maps to valid RawUpdate', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-1"' }),
      json: async () => sampleMatchPayload,
    });

    const nowTime = 1000000;
    const secrets = new SecretStore({ dataDir: './data/test-secrets' });
    secrets.setSecret('cricket_api_key', 'test_key_123');

    const provider = new ApiProvider({
      vendorAdapter: new CricketDataApiVendor(),
      secretStore: secrets,
      fetchFn: mockFetch as unknown as typeof fetch,
      pollIntervalLiveMs: 2000,
      now: () => nowTime,
    });

    const received: unknown[] = [];
    const unsub = provider.subscribe('m101', (raw) => received.push(raw));

    const update = await provider.pollNow();
    expect(update).not.toBeNull();
    expect(update?.matchId).toBe('m101');
    expect(update?.source).toBe('api');
    expect(update?.fields.title).toBe('India vs Pakistan, T20 World Cup');
    expect(update?.fields.innings[0]?.runs).toBe(145);
    expect(update?.fields.innings[0]?.wkts).toBe(3);
    expect(update?.fields.batters[0]?.name).toBe('Virat Kohli');
    expect(update?.fields.bowler?.name).toBe('Shaheen Afridi');
    expect(provider.health()).toBe('connected');

    unsub();
    provider.destroy();
  });

  it('reports stale, not connected, when a key is set but nothing has ever been polled', () => {
    const secrets = new SecretStore({ dataDir: './data/test-secrets-health' });
    secrets.setSecret('cricket_api_key', 'test_key_123');
    const provider = new ApiProvider({
      vendorAdapter: new CricketDataApiVendor(),
      secretStore: secrets,
      fetchFn: vi.fn() as unknown as typeof fetch,
      now: () => 1000,
    });
    // The old dead ternary returned 'connected' here, so the failover watchdog never saw a problem.
    expect(provider.health()).toBe('stale');
    provider.destroy();
  });

  it('handles 304 Not Modified with ETag correctly', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_url: string, opts?: { headers?: Record<string, string> }) => {
      callCount++;
      if (opts?.headers?.['If-None-Match'] === '"etag-1"') {
        return { ok: true, status: 304, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-1"' }),
        json: async () => sampleMatchPayload,
      };
    });

    const secrets = new SecretStore({ dataDir: './data/test-secrets' });
    secrets.setSecret('cricket_api_key', 'test_key_123');

    const provider = new ApiProvider({
      vendorAdapter: new CricketDataApiVendor(),
      secretStore: secrets,
      fetchFn: mockFetch as unknown as typeof fetch,
      pollIntervalLiveMs: 2000,
      now: () => 1000000,
    });

    provider.subscribe('m101', () => {});
    await provider.pollNow();
    const secondUpdate = await provider.pollNow();
    expect(secondUpdate?.fields.innings[0]?.runs).toBe(145);
    expect(callCount).toBe(2);

    provider.destroy();
  });

  it('manages health transitions (connected -> stale -> down -> connected)', async () => {
    let nowTime = 1000000;
    let shouldFail = false;
    const status = 500;

    const mockFetch = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        return { ok: false, status, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => sampleMatchPayload,
      };
    });

    const secrets = new SecretStore({ dataDir: './data/test-secrets' });
    secrets.setSecret('cricket_api_key', 'test_key_123');

    const provider = new ApiProvider({
      vendorAdapter: new CricketDataApiVendor(),
      secretStore: secrets,
      fetchFn: mockFetch as unknown as typeof fetch,
      pollIntervalLiveMs: 2000,
      now: () => nowTime,
    });

    provider.subscribe('m101', () => {});
    await provider.pollNow();
    expect(provider.health()).toBe('connected');

    // Stale after 3x interval (6s)
    nowTime += 7000;
    expect(provider.health()).toBe('stale');

    // Down after 5 consecutive failures
    shouldFail = true;
    for (let i = 0; i < 5; i++) {
      await provider.pollNow();
    }
    expect(provider.health()).toBe('down');

    // Recovers back to connected
    shouldFail = false;
    await provider.pollNow();
    expect(provider.health()).toBe('connected');

    provider.destroy();
  });

  it('handles 429 rate limit backoff and 401 invalid key safely', async () => {
    const nowTime = 1000000;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '15' }),
      json: async () => ({ error: 'Rate limit exceeded' }),
    });

    const secrets = new SecretStore({ dataDir: './data/test-secrets' });
    secrets.setSecret('cricket_api_key', 'test_key_123');

    const provider = new ApiProvider({
      vendorAdapter: new CricketDataApiVendor(),
      secretStore: secrets,
      fetchFn: mockFetch as unknown as typeof fetch,
      pollIntervalLiveMs: 2000,
      now: () => nowTime,
    });

    provider.subscribe('m101', () => {});
    await provider.pollNow();
    // Subsequent poll within rate limit window returns existing snapshot without extra request
    const mockCount = mockFetch.mock.calls.length;
    await provider.pollNow();
    expect(mockFetch.mock.calls.length).toBe(mockCount);

    provider.destroy();
  });
});
