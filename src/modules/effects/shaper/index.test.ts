import { describe, expect, it } from 'vitest';
import { SR, audioSim, peak, rms } from '../../../../tests/helpers/audio';
import { shape } from './index';

const sine = (f: number, a = 1) => (t: number) => a * Math.sin(2 * Math.PI * f * t);

function run(params: Record<string, number>, fn = sine(100), seconds = 0.5) {
  return audioSim(
    [{ id: 's', module: 'signal', config: { fn } }, { id: 'sh', module: 'shaper', params }],
    [{ from: 's.out', to: 'sh.in' }],
    ['sh.out'],
  )
    .run(seconds)
    .get('sh.out')![0]!;
}

/** Ampiezza dell'armonica k di una fondamentale f (DFT a una frequenza). */
function harmonic(x: Float32Array, f: number, k: number, from = 0.1): number {
  let re = 0;
  let im = 0;
  const a = Math.floor(from * SR);
  for (let i = a; i < x.length; i++) {
    const ph = (2 * Math.PI * f * k * i) / SR;
    re += x[i]! * Math.cos(ph);
    im += x[i]! * Math.sin(ph);
  }
  return (2 * Math.hypot(re, im)) / (x.length - a);
}

describe('curve dello Shaper', () => {
  it('dispari, limitate, e con drive basso quasi lineari', () => {
    for (const mode of [0, 1, 2]) {
      for (const x of [0.1, 0.5, 0.9]) expect(shape(mode, -x, 3, 3)).toBeCloseTo(-shape(mode, x, 3, 3), 9);
      for (let i = -20; i <= 20; i++) expect(Math.abs(shape(mode, i / 10, 8, 5))).toBeLessThanOrEqual(1 + 1e-3);
    }
    expect(shape(1, 0.1, 0.1, 3)).toBeCloseTo(0.1, 2); // tanh normalizzata: a drive basso l'uscita è circa l'ingresso
  });
});

describe('Shaper', () => {
  it('chebyshev ordine 3 su un seno pieno: esce la terza armonica', () => {
    const y = run({ mode: 2, drive: 1, order: 3, level: 1 });
    expect(harmonic(y, 100, 3)).toBeGreaterThan(0.8);
    expect(harmonic(y, 100, 1)).toBeLessThan(0.1);
  });

  it('più drive nel fold = più armoniche alte', () => {
    const soft = run({ mode: 0, drive: 1, level: 1 });
    const hard = run({ mode: 0, drive: 6, level: 1 });
    const upper = (x: Float32Array) => [5, 7, 9, 11].reduce((s, k) => s + harmonic(x, 100, k), 0);
    expect(upper(hard)).toBeGreaterThan(upper(soft) * 5);
  });

  it('la simmetria aggiunge armoniche pari, senza lasciare componente continua', () => {
    const y = run({ mode: 1, drive: 4, symmetry: 0.8, level: 1 }, sine(100), 1);
    expect(harmonic(y, 100, 2)).toBeGreaterThan(0.05);
    const tail = y.slice(Math.floor(0.5 * SR));
    const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });

  it('mix 0 lascia passare il segnale pulito', () => {
    const y = run({ mix: 0, level: 1, drive: 10 });
    expect(rms(y, 1000)).toBeCloseTo(Math.SQRT1_2, 2);
    expect(peak(y)).toBeLessThanOrEqual(1.0001);
  });
});
