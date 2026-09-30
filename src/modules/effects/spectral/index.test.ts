import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms } from '../../../../tests/helpers/audio';
import { N } from './index';

const through = (params: Record<string, number>, freq = 440, seconds = 0.5) =>
  audioSim(
    [
      { id: 's', module: 'signal', config: { fn: (t: number) => 0.5 * Math.sin(2 * Math.PI * freq * t) } },
      { id: 'x', module: 'spectral', params: { smear: 0, mix: 1, ...params } },
    ],
    [{ from: 's.out', to: 'x.in' }],
    ['x.out'],
  )
    .run(seconds)
    .get('x.out')![0]!;

describe('Spettrale', () => {
  it('senza elaborazioni ricostruisce il segnale, in ritardo di N campioni', () => {
    const x = through({ tilt: 0, lowCut: 20, highCut: 22000 });
    for (let i = 10000; i < 11000; i += 53) expect(x[i]).toBeCloseTo(0.5 * Math.sin((2 * Math.PI * 440 * (i - N)) / SR), 2);
  });

  it('il taglio alto spegne ciò che sta sopra', () => {
    expect(rms(through({ highCut: 1000 }, 4000), 0.2 * SR)).toBeLessThan(0.01);
  });
});
