import { describe, expect, it } from 'vitest';
import { SR, audioSim, peak } from '../../../../tests/helpers/audio';
import { transfer } from './index';

describe('transfer', () => {
  it('sotto la soglia non tocca, sopra divide per il rapporto', () => {
    expect(transfer(-30, -20, 4, 6)).toBe(-30);
    expect(transfer(0, -20, 4, 6)).toBeCloseTo(-15, 9);
  });
});

describe('Dinamica', () => {
  const sine = (amp: number) => ({ id: 's', module: 'signal', config: { fn: (t: number) => amp * Math.sin(2 * Math.PI * 200 * t) } });

  it('compressore: un seno a 0 dB con soglia −20 e rapporto 4 esce a circa −15 dB', () => {
    const x = audioSim([sine(1), { id: 'd', module: 'dynamics', params: { threshold: -20, ratio: 4, attack: 0.002, release: 0.05 } }], [{ from: 's.out', to: 'd.in' }], ['d.out']).run(0.5).get('d.out')![0]!;
    const db = 20 * Math.log10(peak(x, 0.3 * SR));
    expect(db).toBeGreaterThan(-17);
    expect(db).toBeLessThan(-12);
  });

  it('limiter: nessun picco sopra la soglia', () => {
    const x = audioSim([sine(1), { id: 'd', module: 'dynamics', params: { mode: 1, threshold: -6 } }], [{ from: 's.out', to: 'd.in' }], ['d.out']).run(0.3).get('d.out')![0]!;
    expect(peak(x, 0.01 * SR)).toBeLessThan(Math.pow(10, -6 / 20) * 1.05);
  });

  it('duck: il sidechain abbassa l ingresso', () => {
    const x = audioSim(
      [
        sine(0.5),
        { id: 'k', module: 'signal', config: { fn: (t: number) => (t > 0.2 ? Math.sin(2 * Math.PI * 60 * t) : 0) } },
        { id: 'd', module: 'dynamics', params: { mode: 2, depth: 0.8, attack: 0.002 } },
      ],
      [
        { from: 's.out', to: 'd.in' },
        { from: 'k.out', to: 'd.side' },
      ],
      ['d.out'],
    )
      .run(0.4)
      .get('d.out')![0]!;
    expect(peak(x, 0.1 * SR, 0.19 * SR)).toBeGreaterThan(0.45);
    expect(peak(x, 0.3 * SR, 0.39 * SR)).toBeLessThan(0.2);
  });
});
