import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { onBackbeat } from './index';

describe('onBackbeat', () => {
  it('riconosce il 2 e il 4', () => {
    expect([0, 0.25, 0.5, 0.75, 0.125].map((p) => onBackbeat(p, 0))).toEqual([false, true, false, true, false]);
    expect([0.25, 0.75].map((p) => onBackbeat(p, 2))).toEqual([false, true]);
  });
});

describe('Snare displacement', () => {
  it('con probabilità 1 sposta 2 e 4 di un sedicesimo, gli altri beat restano', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 's', module: 'snareShift', params: { which: 0, shift: 3, prob: 1 } }],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 's.in' },
        { from: 'tr.bar', to: 's.phase' },
      ],
      ['s.out'],
    );
    sim.runTo(1);
    expect(sim.events('s.out').map((e) => e.t)).toEqual([0, 0.625, 1, 1.625].map((x) => expect.closeTo(x, 6)));
  });

  it('in anticipo di un trentaduesimo: 62.5 ms a 120 BPM, limitati ai 60 ms di anticipo massimo', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 's', module: 'snareShift', params: { which: 1, shift: 1, prob: 1 } }],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 's.in' },
        { from: 'tr.bar', to: 's.phase' },
      ],
      ['s.out'],
    );
    sim.runTo(1);
    expect(sim.events('s.out').map((e) => e.t)).toEqual([0, 0.44, 1, 1.5].map((x) => expect.closeTo(x, 6)));
  });
});
