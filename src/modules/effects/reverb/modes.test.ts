import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms } from '../../../../tests/helpers/audio';

const burst = (t: number) => (t < 0.05 ? Math.sin(2 * Math.PI * 300 * t) : 0);

const tail = (params: Record<string, number>) =>
  audioSim([{ id: 's', module: 'signal', config: { fn: burst } }, { id: 'r', module: 'reverb', params: { mix: 1, decay: 0.5, ...params } }], [{ from: 's.out', to: 'r.in' }], ['r.out'])
    .run(2)
    .get('r.out')![0]!;

describe('Reverb: plate e freeze', () => {
  it('plate: una coda che decade', () => {
    const x = tail({ type: 1 });
    expect(rms(x, 0.1 * SR, 0.2 * SR)).toBeGreaterThan(0.01);
    expect(rms(x, 1.5 * SR, 1.9 * SR)).toBeLessThan(rms(x, 0.1 * SR, 0.2 * SR) / 100);
  });

  it('freeze: la coda resta sospesa', () => {
    const x = audioSim(
      [{ id: 's', module: 'signal', config: { fn: burst } }, { id: 'r', module: 'reverb', params: { mix: 1, decay: 0.5, freeze: 0 } }],
      [{ from: 's.out', to: 'r.in' }],
      ['r.out'],
    );
    x.run(0.1);
    x.graph.setParam('r', 'freeze', 1);
    const y = x.run(2).get('r.out')![0]!;
    expect(rms(y, 1.5 * SR, 1.9 * SR)).toBeGreaterThan(rms(y, 0, 0.1 * SR) * 0.5);
  });
});
