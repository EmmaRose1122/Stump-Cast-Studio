/** Tiny PCM WAV writer and tone synthesiser: generated placeholder sounds, no third-party audio. */

export const SAMPLE_RATE = 22_050;

export const encodeWav = (samples: Float32Array, rate = SAMPLE_RATE): Buffer => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

/** A sine note with a short attack and an exponential decay. */
const note = (freq: number, seconds: number, gain = 0.5, rate = SAMPLE_RATE): Float32Array => {
  const n = Math.floor(seconds * rate);
  const out = new Float32Array(n);
  const attack = Math.floor(0.005 * rate);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, i / attack) * Math.exp(-4 * (i / n));
    out[i] = Math.sin(2 * Math.PI * freq * t) * env * gain;
  }
  return out;
};

const concat = (parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const mix = (a: Float32Array, b: Float32Array): Float32Array => {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
};

export const SAMPLE_SOUNDS = [
  {
    id: 'sample-four',
    title: 'Four (chime)',
    build: () => concat([note(880, 0.18), note(1320, 0.4)]),
  },
  {
    id: 'sample-six',
    title: 'Six (rising)',
    build: () => concat([note(523, 0.14), note(659, 0.14), note(784, 0.14), note(1047, 0.5)]),
  },
  {
    id: 'sample-wicket',
    title: 'Wicket (thud)',
    build: () => mix(note(110, 0.6, 0.7), concat([note(220, 0.12, 0.3), note(165, 0.5, 0.2)])),
  },
] as const;
