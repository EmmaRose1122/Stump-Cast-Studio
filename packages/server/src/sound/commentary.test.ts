import { describe, expect, it } from 'vitest';
import { CommentaryService } from './CommentaryService';
import type { EngineEvent } from '@stumpcast/shared';

describe('CommentaryService', () => {
  it('initializes with default config and empty history', () => {
    const service = new CommentaryService();
    const config = service.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.autoEvents).toBe(true);
    expect(service.getHistory()).toEqual([]);
  });

  it('updates configuration with validation', () => {
    const service = new CommentaryService();
    const updated = service.updateConfig({ rate: 1.2, volume: 0.8 });
    expect(updated.rate).toBe(1.2);
    expect(updated.volume).toBe(0.8);
  });

  it('generates commentary item on match events when autoEvents is on', () => {
    const service = new CommentaryService({ autoEvents: true });
    const ev: EngineEvent = {
      id: 'e1',
      matchId: 'm1',
      type: 'FOUR',
      at: new Date().toISOString(),
      payload: { batter: 'Aiden Markram' },
    };

    const item = service.onEvent(ev);
    expect(item).not.toBeNull();
    expect(item?.text).toContain('Aiden Markram');
    expect(item?.eventType).toBe('FOUR');
    expect(service.getHistory()).toHaveLength(1);
  });

  it('suppresses auto commentary when autoEvents is disabled', () => {
    const service = new CommentaryService({ autoEvents: false });
    const ev: EngineEvent = {
      id: 'e2',
      matchId: 'm1',
      type: 'SIX',
      at: new Date().toISOString(),
      payload: { batter: 'Aiden Markram' },
    };

    const item = service.onEvent(ev);
    expect(item).toBeNull();
    expect(service.getHistory()).toHaveLength(0);
  });

  it('allows manual speech and limits history size', () => {
    const service = new CommentaryService();
    const item = service.speak('Welcome to live cricket broadcast!');
    expect(item.text).toBe('Welcome to live cricket broadcast!');
    expect(item.eventType).toBe('CUSTOM');
    expect(service.getHistory()[0]!.text).toBe('Welcome to live cricket broadcast!');
  });
});
