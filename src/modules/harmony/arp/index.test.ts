import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { arpOrder } from './index';

describe('arpOrder', () => {
  it('su-giù non ripete gli estremi', () => {
    expect(arpOrder(4, 2)).toEqual([0, 1, 2, 3, 2, 1]);
  });
});

describe('Arp', () => {
  it('Do maggiore in su, due ottave, 8 step per battuta', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'c', module: 'chords', params: { type: 0, bass: 0, octave: 60 } },
        { id: 'a', module: 'arp', params: { steps: 8, pattern: 0, octaves: 2 } },
      ],
      [
        { from: 'c.chord', to: 'a.chord' },
        { from: 'tr.bar', to: 'a.phase' },
      ],
      ['a.note'],
    );
    sim.runTo(1);
    expect(sim.events('a.note').map((e) => (e.kind === 'note' ? e.pitch : 0))).toEqual([60, 64, 67, 72, 76, 79, 60, 64]);
  });
});
