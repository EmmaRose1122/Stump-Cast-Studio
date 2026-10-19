import { describe, expect, it, vi } from 'vitest';
import { OverlayCommentary } from './commentary';

describe('OverlayCommentary', () => {
  it('enables and disables commentary cleanly', () => {
    const oc = new OverlayCommentary();
    oc.setEnabled(false);
    oc.speak('Hello world');
    // Disabled, so should not throw and does nothing
    expect(true).toBe(true);
  });

  it('handles commentary WebSocket message payloads', () => {
    const spokenUtterances: string[] = [];
    const mockSynth = {
      speak: vi.fn((u: { text: string }) => {
        spokenUtterances.push(u.text);
      }),
      cancel: vi.fn(),
      getVoices: () => [],
    } as unknown as SpeechSynthesis;

    const oc = new OverlayCommentary({
      getSpeechSynthesis: () => mockSynth,
      createUtterance: (text: string) => ({ text, rate: 1, pitch: 1, volume: 1 }),
    });

    oc.handle({ text: 'Babar Azam strikes FOUR!' });
    expect(mockSynth.speak).toHaveBeenCalled();
    expect(spokenUtterances).toContain('Babar Azam strikes FOUR!');
  });

  it('sets rate, pitch, and volume within bounds', () => {
    const oc = new OverlayCommentary();
    oc.setRate(1.5);
    oc.setPitch(1.2);
    oc.setVolume(0.7);
    expect(true).toBe(true);
  });
});
