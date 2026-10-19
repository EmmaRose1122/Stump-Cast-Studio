import { describe, expect, it } from 'vitest';
import {
  ProviderFailoverManager,
  type CandidateMatch,
  type FailoverEvent,
} from './ProviderFailover';

describe('ProviderFailoverManager', () => {
  it('does not trigger failover when active match is healthy', () => {
    let activeId: string | null = 'match-cricbuzz';
    const matches: CandidateMatch[] = [
      { id: 'match-cricbuzz', title: 'Cricbuzz Feed', source: 'cricbuzz', health: 'connected' },
      { id: 'match-crex', title: 'Crex Feed', source: 'crex', health: 'connected' },
    ];

    const mgr = new ProviderFailoverManager({
      getActiveMatchId: () => activeId,
      setActiveMatchId: (id) => {
        activeId = id;
      },
      getAvailableMatches: () => matches,
    });

    const res = mgr.evaluateHealth('connected', null);
    expect(res.failedOver).toBe(false);
    expect(activeId).toBe('match-cricbuzz');
  });

  it('automatically fails over to healthy alternate feed when active feed becomes stale', () => {
    let activeId: string | null = 'match-cricbuzz';
    let emittedEvent: FailoverEvent | undefined = undefined;
    const matches: CandidateMatch[] = [
      { id: 'match-cricbuzz', title: 'Cricbuzz Feed', source: 'cricbuzz', health: 'stale' },
      { id: 'match-crex', title: 'Crex Backup Feed', source: 'crex', health: 'connected' },
    ];

    const mgr = new ProviderFailoverManager(
      {
        getActiveMatchId: () => activeId,
        setActiveMatchId: (id) => {
          activeId = id;
        },
        getAvailableMatches: () => matches,
        onFailover: (ev) => {
          emittedEvent = ev;
        },
      },
      { autoFailoverEnabled: true },
    );

    const res = mgr.evaluateHealth('stale', 'DATA_STALE');
    expect(res.failedOver).toBe(true);
    expect(activeId).toBe('match-crex');
    expect(emittedEvent).toBeDefined();
    const ev = emittedEvent as unknown as FailoverEvent;
    expect(ev.fromMatchId).toBe('match-cricbuzz');
    expect(ev.toMatchId).toBe('match-crex');
  });

  it('respects explicit fallback match preference', () => {
    let activeId: string | null = 'm1';
    const matches: CandidateMatch[] = [
      { id: 'm1', title: 'Source 1', source: 'cricbuzz', health: 'down' },
      { id: 'm2', title: 'Source 2', source: 'manual', health: 'connected' },
      { id: 'm3', title: 'Source 3', source: 'crex', health: 'connected' },
    ];

    const mgr = new ProviderFailoverManager(
      {
        getActiveMatchId: () => activeId,
        setActiveMatchId: (id) => {
          activeId = id;
        },
        getAvailableMatches: () => matches,
      },
      { fallbackMatchId: 'm3' },
    );

    const res = mgr.evaluateHealth('down', 'PROVIDER_DOWN');
    expect(res.failedOver).toBe(true);
    expect(activeId).toBe('m3');
  });

  it('supports operator 1-click manual switch', () => {
    let activeId: string | null = 'm1';
    const matches: CandidateMatch[] = [
      { id: 'm1', title: 'Source 1', source: 'cricbuzz', health: 'connected' },
      { id: 'm2', title: 'Source 2', source: 'crex', health: 'connected' },
    ];

    const mgr = new ProviderFailoverManager({
      getActiveMatchId: () => activeId,
      setActiveMatchId: (id) => {
        activeId = id;
      },
      getAvailableMatches: () => matches,
    });

    const res = mgr.manualSwitch('m2');
    expect(res.ok).toBe(true);
    expect(activeId).toBe('m2');
  });
});
