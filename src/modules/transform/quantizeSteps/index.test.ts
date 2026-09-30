import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { toSteps } from './index';

describe('Quantize a scalini', () => {
  it('gradini equidistanti tra lo e hi', () => {
    expect(toSteps(0.3, 5, 0, 1)).toBe(0.25);
    expect(toSteps(0.4, 5, 0, 1)).toBe(0.5);
    expect(toSteps(2, 5, 0, 1)).toBe(1);
    expect(toSteps(0.3, 2, -1, 1)).toBe(1);
  });

  it('un trigger a ogni cambio di gradino', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'l', module: 'lfo', params: { shape: 2 } }, { id: 'q', module: 'quantizeSteps', params: { levels: 5 } }],
      [{ from: 'tr.bar', to: 'l.phase' }, { from: 'l.out', to: 'q.in' }],
      ['q.trig'],
    );
    sim.runTo(1);
    // la rampa 0→1 attraversa 4 soglie in una battuta, poi a fine battuta riparte da 0
    expect(sim.events('q.trig').map((e) => (e as { value: number }).value)).toEqual([0.25, 0.5, 0.75, 1, 0]);
  });
});
