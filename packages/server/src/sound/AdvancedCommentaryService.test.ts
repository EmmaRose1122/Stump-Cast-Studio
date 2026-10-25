import { describe, expect, it, vi } from 'vitest';
import { fixtures } from '@stumpcast/shared';
import { AdvancedCommentaryService, type AdvancedCommentaryRequest } from './AdvancedCommentaryService';

describe('AdvancedCommentaryService analyst mode', () => {
  it('asks the model for analysis with real match state and respects the minimum gap', async () => {
    let now = 10_000;
    const service = new AdvancedCommentaryService(
      {
        language: 'hi',
        ai: true,
        continuousMode: true,
        tacticalAnalysis: true,
        minGapMs: 8_000,
      },
      () => now,
    );
    const generate = vi.fn(async (_request: AdvancedCommentaryRequest) =>
      'भारत को संभलकर खेलना होगा। अगले ओवरों में साझेदारी अहम है।',
    );
    service.setGenerator(generate, () => true);

    const first = await service.onAnalysisAsync(fixtures.t20);
    expect(first).toMatchObject({ eventType: 'ANALYSIS', lang: 'hi' });
    expect(first?.text).toContain('साझेदारी');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ mode: 'analysis' });

    now += 2_000;
    expect(await service.onAnalysisAsync(fixtures.t20)).toBeNull();
    now += 6_000;
    expect(service.analysisDue()).toBe(true);
  });

  it('keeps a factual local analysis line when AI is unavailable', async () => {
    const service = new AdvancedCommentaryService(
      { language: 'hi', ai: false, continuousMode: true, tacticalAnalysis: true },
      () => 50_000,
    );
    const item = await service.onAnalysisAsync(fixtures.t20);
    expect(item).toMatchObject({ eventType: 'ANALYSIS', lang: 'hi' });
    expect(item?.text.length).toBeGreaterThan(10);
  });

  it('stays quiet when continuous analysis is disabled', async () => {
    const service = new AdvancedCommentaryService(
      { continuousMode: false, tacticalAnalysis: true },
      () => 80_000,
    );
    expect(service.analysisDue()).toBe(false);
    expect(await service.onAnalysisAsync(fixtures.t20)).toBeNull();
  });
});
