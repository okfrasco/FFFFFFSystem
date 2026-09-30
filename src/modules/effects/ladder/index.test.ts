import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms } from '../../../../tests/helpers/audio';

const sineThrough = (freq: number, params: Record<string, number>) =>
  audioSim(
    [
      { id: 's', module: 'signal', config: { fn: (t: number) => 0.1 * Math.sin(2 * Math.PI * freq * t) } },
      { id: 'f', module: 'ladder', params },
    ],
    [{ from: 's.out', to: 'f.in' }],
    ['f.out'],
  )
    .run(0.3)
    .get('f.out')![0]!;

const gainAt = (freq: number, params: Record<string, number>) => rms(sineThrough(freq, params), 0.1 * SR) / (0.1 / Math.SQRT2);

describe('Ladder', () => {
  it('24 dB per ottava: due ottave sopra il cutoff ~ −48 dB', () => {
    const p = { cutoff: 500, resonance: 0 };
    expect(gainAt(100, p)).toBeGreaterThan(0.8);
    expect(20 * Math.log10(gainAt(2000, p))).toBeLessThan(-40);
  });

  it('la risonanza alza il picco sul cutoff', () => {
    expect(gainAt(1000, { cutoff: 1000, resonance: 0.9 })).toBeGreaterThan(gainAt(1000, { cutoff: 1000, resonance: 0 }) * 3);
  });

  it('passa-alto: taglia i bassi', () => {
    expect(gainAt(100, { mode: 3, cutoff: 2000, resonance: 0 })).toBeLessThan(0.05);
  });
});
