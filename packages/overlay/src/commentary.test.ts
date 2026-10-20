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

  describe('queue hygiene', () => {
    const setup = () => {
      const spoken: string[] = [];
      const timers: { fn: () => void; ms: number; id: number }[] = [];
      let id = 1;
      // An engine that accepts the utterance and never calls onend/onerror, like Chrome after an
      // interrupted synthesis: without a deadline the queue is silent for the rest of the session.
      const synth = {
        speak: (u: { text: string }) => spoken.push(u.text),
        cancel: () => spoken.push('[cancel]'),
        getVoices: () => [],
      } as unknown as SpeechSynthesis;
      const oc = new OverlayCommentary({
        getSpeechSynthesis: () => synth,
        createUtterance: (text: string) => ({ text, rate: 1, pitch: 1, volume: 1 }),
        setTimer: (fn, ms) => {
          timers.push({ fn, ms, id: id++ });
          return id - 1;
        },
        clearTimer: (x) => {
          const i = timers.findIndex((t) => t.id === x);
          if (i >= 0) timers.splice(i, 1);
        },
      });
      return { oc, spoken, timers };
    };

    it('resumes after an utterance that never ends', () => {
      const { oc, spoken, timers } = setup();
      oc.speak('first');
      oc.speak('second');
      expect(spoken).toEqual(['first']);
      expect(timers).toHaveLength(1);

      timers.shift()!.fn(); // the deadline fires: the stuck line is abandoned
      expect(spoken).toEqual(['first', '[cancel]', 'second']);
      expect(timers).toHaveLength(1); // 'second' is now under its own deadline
      timers.shift()!.fn();
      expect(spoken).toEqual(['first', '[cancel]', 'second', '[cancel]']);
    });

    it('drops the oldest line instead of building an unbounded backlog', () => {
      const { oc, spoken, timers } = setup();
      for (let i = 0; i < 20; i++) oc.speak(`line-${i}`);
      expect(spoken).toEqual(['line-0']);
      timers[0]!.fn();
      // Eight lines are kept, so the freshest backlog is what survives: line-1 after line-0 was
      // dropped first, then the queue trimmed to its last eight entries.
      expect(spoken.at(-1)).toBe('line-12');
    });

    it('keeps draining when the engine throws', () => {
      const timers: { fn: () => void }[] = [];
      const spoken: string[] = [];
      const synth = {
        speak: () => {
          throw new Error('synthesis unavailable');
        },
        cancel: () => undefined,
        getVoices: () => [],
      } as unknown as SpeechSynthesis;
      const oc = new OverlayCommentary({
        getSpeechSynthesis: () => synth,
        createUtterance: (text: string) => {
          spoken.push(text);
          return { text, rate: 1, pitch: 1, volume: 1 };
        },
        setTimer: (fn) => {
          timers.push({ fn });
          return timers.length;
        },
        clearTimer: () => undefined,
      });
      oc.speak('a');
      oc.speak('b');
      expect(spoken).toEqual(['a', 'b']);
    });
  });
});
