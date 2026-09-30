import { describe, expect, it } from 'vitest';
import { SR, audioSim, brightness, cents, pitchOf, rms } from '../../../../tests/helpers/audio';
import { OPS, mId } from './index';

/** Parametri con tutta la matrice a zero e il solo operatore 1 in uscita. */
function plain(extra: Record<string, number> = {}) {
  const p: Record<string, number> = { o1: 1, o2: 0, o3: 0, o4: 0, s1: 1, pitch: 57 };
  for (let i = 0; i < OPS; i++) for (let j = 0; j < OPS; j++) p[mId(i, j)] = 0;
  return { ...p, ...extra };
}

describe('FM', () => {
  const run = (params: Record<string, number>, seconds = 0.4) =>
    audioSim([{ id: 'f', module: 'fm', params }], [], ['f.out']).run(seconds).get('f.out')![0]!;

  it('senza modulazione è un seno intonato', () => {
    const x = run(plain());
    expect(Math.abs(cents(pitchOf(x, 0.1, 0.3), 220))).toBeLessThan(3);
    expect(brightness(x, 0.1 * SR)).toBeCloseTo((2 * Math.PI * 220) / SR, 2);
  });

  it('la modulazione 2 → 1 apre lo spettro, il feedback anche', () => {
    const base = brightness(run(plain()), 0.1 * SR);
    expect(brightness(run(plain({ m1_2: 0.5, s2: 1 })), 0.1 * SR)).toBeGreaterThan(base * 2);
    expect(brightness(run(plain({ m1_1: 0.6 })), 0.1 * SR)).toBeGreaterThan(base * 2);
  });

  it('il gate apre e chiude gli inviluppi', () => {
    const x = audioSim(
      [
        { id: 'g', module: 'signal', config: { fn: (t: number) => (t > 0.05 && t < 0.2 ? 1 : 0) } },
        { id: 'f', module: 'fm', params: plain({ rl1: 0.02 }) },
      ],
      [{ from: 'g.out', to: 'f.gate' }],
      ['f.out'],
    )
      .run(0.5)
      .get('f.out')![0]!;
    expect(rms(x, 0, 0.04 * SR)).toBe(0);
    expect(rms(x, 0.1 * SR, 0.15 * SR)).toBeGreaterThan(0.1);
    expect(rms(x, 0.4 * SR, 0.45 * SR)).toBeLessThan(1e-3);
  });
});
