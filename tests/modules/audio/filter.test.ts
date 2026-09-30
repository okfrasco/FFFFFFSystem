import { describe, expect, it } from 'vitest';
import { audioSim, rms } from '../../helpers/audio';

function filtered(freq: number, params: Record<string, number>) {
  const x = audioSim(
    [{ id: 's', module: 'signal', config: { fn: (t: number) => Math.sin(2 * Math.PI * freq * t) } }, { id: 'f', module: 'filter', params }],
    [{ from: 's.out', to: 'f.in' }],
    ['f.out'],
  )
    .run(0.5)
    .get('f.out')![0]!;
  return rms(x, x.length / 2) / Math.SQRT1_2;
}

describe('Filtro SVF', () => {
  it('passa-basso: passa i bassi, taglia gli alti (12 dB/ott)', () => {
    expect(filtered(100, { mode: 0, cutoff: 1000, resonance: 0 })).toBeGreaterThan(0.95);
    expect(filtered(8000, { mode: 0, cutoff: 1000, resonance: 0 })).toBeLessThan(0.03);
  });

  it('passa-alto: il contrario', () => {
    expect(filtered(100, { mode: 2, cutoff: 1000, resonance: 0 })).toBeLessThan(0.03);
    expect(filtered(8000, { mode: 2, cutoff: 1000, resonance: 0 })).toBeGreaterThan(0.95);
  });

  it('la risonanza alza il picco al cutoff', () => {
    expect(filtered(1000, { mode: 0, cutoff: 1000, resonance: 0.9 })).toBeGreaterThan(4);
  });

  it('resta stabile con risonanza massima e cutoff estremi', () => {
    for (const cutoff of [20, 20000]) expect(Number.isFinite(filtered(500, { mode: 1, cutoff, resonance: 1 }))).toBe(true);
  });

  it('mod sposta il cutoff in ottave', () => {
    const x = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number) => Math.sin(2 * Math.PI * 4000 * t) } },
        { id: 'm', module: 'signal', config: { fn: () => 1 } },
        { id: 'f', module: 'filter', params: { mode: 0, cutoff: 250, resonance: 0, modDepth: 0.667 } },
      ],
      [{ from: 's.out', to: 'f.in' }, { from: 'm.out', to: 'f.mod' }],
      ['f.out'],
    )
      .run(0.3)
      .get('f.out')![0]!;
    // 250 Hz · 2^4 = 4000 Hz: al cutoff un passa-basso senza risonanza dà ~−6 dB
    const level = rms(x, x.length / 2) / Math.SQRT1_2;
    expect(level).toBeGreaterThan(0.35);
    expect(level).toBeLessThan(0.7);
  });
});
