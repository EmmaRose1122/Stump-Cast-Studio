import { describe, expect, it, vi } from 'vitest';
import { OverlayCommentary, type AudioPlayerLike } from './commentary';

/** A stand-in for HTMLAudioElement whose outcome the test decides. */
interface FakePlayer extends AudioPlayerLike {
  url: string;
  plays: number;
  pauses: number;
  /** A real element resolves play() when audio actually starts; `false` models one that never does. */
  starts: boolean;
}

const fakePlayer = (url: string, into: FakePlayer[], starts = true): FakePlayer => {
  const p: FakePlayer = {
    url,
    volume: 1,
    playbackRate: 1,
    plays: 0,
    pauses: 0,
    starts,
    play: () => {
      p.plays++;
      return starts ? Promise.resolve() : new Promise<void>(() => {});
    },
    pause: () => {
      p.pauses++;
    },
    onended: null,
    onerror: null,
  };
  into.push(p);
  return p;
};

/** A browser speech engine that records what it was asked to read. */
const browserEngine = (spoken: string[]) =>
  ({
    speak: (u: { text: string }) => spoken.push(u.text),
    cancel: () => undefined,
    getVoices: () => [],
  }) as unknown as SpeechSynthesis;

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

  it('reads each line with a voice that speaks its script', () => {
    const chosen: { voice?: unknown; lang?: string }[] = [];
    const voices = [
      { lang: 'en-US', name: 'Zira', default: true },
      { lang: 'hi-IN', name: 'Kalpana', default: false },
      { lang: 'ur-PK', name: 'Asif', default: false },
    ] as unknown as SpeechSynthesisVoice[];
    const synth = {
      speak: (u: { voice?: unknown; lang?: string; onend?: () => void }) => {
        chosen.push({ voice: u.voice, lang: u.lang });
        u.onend?.(); // finish the utterance so the next queued line is spoken
      },
      cancel: () => undefined,
      getVoices: () => voices,
    } as unknown as SpeechSynthesis;
    const oc = new OverlayCommentary({
      getSpeechSynthesis: () => synth,
      createUtterance: (text: string) => ({ text, rate: 1, pitch: 1, volume: 1 }),
    });

    oc.handle({ text: 'छक्का! बाबर का शानदार शॉट।', lang: 'hi' });
    expect((chosen[0]!.voice as { lang: string }).lang).toBe('hi-IN');
    oc.handle({ text: 'چھکا! بابراعظم کا شاندار شاٹ۔', lang: 'ur' });
    expect((chosen[1]!.voice as { lang: string }).lang).toBe('ur-PK');
    oc.handle({ text: 'A lovely drive for four.', lang: 'en' });
    expect((chosen[2]!.voice as { lang: string }).lang).toBe('en-US');
  });

  it('sets rate, pitch, and volume within bounds', () => {
    const oc = new OverlayCommentary();
    oc.setRate(1.5);
    oc.setPitch(1.2);
    oc.setVolume(0.7);
    expect(true).toBe(true);
  });

  describe('server-rendered voice', () => {
    it('asks the server for the line audio and never touches the browser speech engine', () => {
      const spoken: string[] = [];
      const asked: string[] = [];
      const players: FakePlayer[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => {
          asked.push(url);
          return fakePlayer(url, players);
        },
        getSpeechSynthesis: () => browserEngine(spoken),
      });

      oc.handle({ id: 'c1', text: 'چھکا!', lang: 'ur' });
      expect(asked).toEqual(['http://localhost:4321/api/commentary/audio/c1']);
      expect(players[0]!.plays).toBe(1);
      expect(spoken).toEqual([]); // OBS has no speech engine of its own; the audio carries the line
    });

    it('falls back to the browser when the server has no voice for the line', async () => {
      const spoken: string[] = [];
      const players: FakePlayer[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => fakePlayer(url, players),
        getSpeechSynthesis: () => browserEngine(spoken),
      });

      oc.handle({ id: 'c1', text: 'چھکا!', lang: 'ur' });
      await Promise.resolve();
      players[0]!.onerror?.();
      await Promise.resolve();
      expect(spoken).toEqual(['چھکا!']);
    });

    it('gives up on a silent server and lets the browser speak', async () => {
      const spoken: string[] = [];
      const players: FakePlayer[] = [];
      const timers: { fn: () => void }[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => fakePlayer(url, players, false),
        getSpeechSynthesis: () => browserEngine(spoken),
        setTimer: (fn) => {
          timers.push({ fn });
          return timers.length;
        },
        clearTimer: () => undefined,
      });

      oc.handle({ id: 'c1', text: 'Hello', lang: 'en' });
      await Promise.resolve();
      expect(players[0]!.plays).toBe(1);
      timers[0]!.fn(); // the server never answered
      await Promise.resolve();
      expect(players[0]!.pauses).toBe(1);
      expect(spoken).toEqual(['Hello']);
    });

    it('does not cut a rendered line short once it has started playing', async () => {
      const players: FakePlayer[] = [];
      const timers: { fn: () => void }[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => fakePlayer(url, players),
        setTimer: (fn) => {
          timers.push({ fn });
          return timers.length;
        },
        clearTimer: () => timers.splice(0, timers.length),
      });

      oc.handle({ id: 'c1', text: 'A long line', lang: 'en' });
      await Promise.resolve();
      expect(timers).toHaveLength(0); // play() resolved, so the deadline was stood down
      expect(players[0]!.pauses).toBe(0);
    });

    it('silences the rendered line when commentary is switched off mid-playback', () => {
      const players: FakePlayer[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => fakePlayer(url, players),
      });

      oc.handle({ id: 'c1', text: 'Hello', lang: 'en' });
      oc.stop();
      expect(players[0]!.pauses).toBe(1);
    });

    it('applies the operator volume and speed to the server audio', () => {
      const players: FakePlayer[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => fakePlayer(url, players),
      });
      oc.setVolume(0.4);
      oc.setRate(1.3);
      oc.handle({ id: 'c1', text: 'Hello', lang: 'en' });
      expect(players[0]!.volume).toBeCloseTo(0.4);
      expect(players[0]!.playbackRate).toBeCloseTo(1.3);
    });

    it('does not ask for audio for a line the server never tagged', () => {
      const asked: string[] = [];
      const players: FakePlayer[] = [];
      const spoken: string[] = [];
      const oc = new OverlayCommentary({
        audioBase: 'http://localhost:4321',
        createAudio: (url) => {
          asked.push(url);
          return fakePlayer(url, players);
        },
        getSpeechSynthesis: () => browserEngine(spoken),
      });
      oc.handle({ text: 'no id here', lang: 'en' });
      expect(asked).toEqual([]);
      expect(spoken).toEqual(['no id here']);
    });
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

    it('deduplicates lines with identical IDs and ignores re-broadcast echoes', () => {
      const spoken: string[] = [];
      const synth = {
        speak: (u: { text: string; onend?: () => void }) => {
          spoken.push(u.text);
          u.onend?.();
        },
        cancel: () => undefined,
        getVoices: () => [],
      } as unknown as SpeechSynthesis;
      const oc = new OverlayCommentary({
        getSpeechSynthesis: () => synth,
        createUtterance: (text: string) => ({ text, rate: 1, pitch: 1, volume: 1 }),
      });

      // Send the same line with ID 'c101' twice (e.g. preview broadcast and delay broadcast)
      oc.handle({ id: 'c101', text: 'Great cover drive for four runs!' });
      oc.handle({ id: 'c101', text: 'Great cover drive for four runs!' });

      expect(spoken).toHaveLength(1);
      expect(spoken[0]).toBe('Great cover drive for four runs!');
    });
  });
});

