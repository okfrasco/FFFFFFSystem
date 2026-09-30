import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { norgard } from './index';

describe('norgard', () => {
  it('i primi termini della serie infinita', () => {
    expect(Array.from({ length: 16 }, (_, n) => norgard(n))).toEqual([0, 1, -1, 2, 1, 0, -2, 3, -1, 2, 0, 1, 2, -1, -3, 4]);
  });

  it('autosimile: un termine ogni 4 ridà la serie, ogni 2 la capovolge', () => {
    for (let n = 0; n < 64; n++) {
      expect(norgard(4 * n)).toBe(norgard(n));
      expect(norgard(2 * n)).toBe(-norgard(n) + 0);
    }
  });
});

describe('Serie infinita', () => {
  it('un termine per step, moltiplicato per intervallo', () => {
    const sim = simulate([TRANSPORT, { id: 's', module: 'infinitySeries', params: { steps: 8, interval: 2 } }], [{ from: 'tr.bar', to: 's.phase' }], ['s.trig']);
    sim.runTo(1);
    expect(sim.events('s.trig').map((e) => (e as { value: number }).value)).toEqual([0, 2, -2, 4, 2, 0, -4, 6]);
  });
});
