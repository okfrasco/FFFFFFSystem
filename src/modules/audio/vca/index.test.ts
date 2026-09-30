import { describe, expect, it } from 'vitest';
import { audioSim } from '../../../../tests/helpers/audio';

describe('VCA', () => {
  it('moltiplica ingresso, cv e guadagno', () => {
    const y = audioSim(
      [
        { id: 'a', module: 'signal', config: { fn: () => 0.5 } },
        { id: 'c', module: 'signal', config: { fn: () => 0.4 } },
        { id: 'v', module: 'vca', params: { gain: 2 } },
      ],
      [{ from: 'a.out', to: 'v.in' }, { from: 'c.out', to: 'v.cv' }],
      ['v.out'],
    )
      .run(0.01)
      .get('v.out')![0]!;
    expect(y[10]).toBeCloseTo(0.4, 6);
  });
});
