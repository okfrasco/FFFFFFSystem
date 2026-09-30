import { describe, expect, it } from 'vitest';
import { mixToDevice } from '../../io/output';
import { audioSim } from '../../../../tests/helpers/audio';

describe('Mixer e Uscita', () => {
  it('pan tutto a sinistra e livelli', () => {
    const [L, R] = audioSim(
      [
        { id: 'a', module: 'signal', config: { fn: () => 0.5 } },
        { id: 'm', module: 'mixer', params: { level1: 1, pan1: -1, master: 1 } },
      ],
      [{ from: 'a.out', to: 'm.in1' }],
      ['m.out'],
    )
      .run(0.01)
      .get('m.out')! as [Float32Array, Float32Array];
    expect(L[5]).toBeCloseTo(0.5 * Math.SQRT2, 5);
    expect(R[5]).toBeCloseTo(0, 5);
  });

  it('mixToDevice: 1 voce su entrambi i lati, 2 voci su sinistra/destra', () => {
    const dest = [new Float32Array(4), new Float32Array(4)];
    mixToDevice([new Float32Array([1, 1, 1, 1])], 0.5, dest);
    expect([dest[0]![0], dest[1]![0]]).toEqual([0.5, 0.5]);
    const d2 = [new Float32Array(4), new Float32Array(4)];
    mixToDevice([new Float32Array([1, 1, 1, 1]), new Float32Array([0, 0, 0, 0])], 1, d2);
    expect([d2[0]![0], d2[1]![0]]).toEqual([1, 0]);
  });
});
