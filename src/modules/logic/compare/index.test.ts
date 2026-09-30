import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { compare } from './index';

describe('compare', () => {
  it('i sei confronti, con tolleranza per = e ≠', () => {
    expect([0, 1, 2, 3, 4, 5].map((op) => compare(op, 0.5, 0.49, 0.02))).toEqual([true, false, true, false, true, false]);
  });
});

describe('Comparatore', () => {
  it('una rampa supera 0.25: il gate si apre a un quarto di battuta, stimato dentro il tick', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'l', module: 'lfo', params: { shape: 2 } }, { id: 'c', module: 'compare', params: { op: 2, b: 0.25 } }],
      [{ from: 'tr.bar', to: 'l.phase' }, { from: 'l.out', to: 'c.a' }],
      ['c.gate', 'c.trig'],
    );
    sim.runTo(1);
    const on = sim.events('c.trig');
    expect(on).toHaveLength(1);
    expect(on[0]!.t).toBeCloseTo(0.5, 2);
  });
});
