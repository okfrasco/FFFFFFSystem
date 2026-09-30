import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { burstTimes } from './index';

describe('burstTimes', () => {
  it('intervalli costanti, che si accorciano o si allungano', () => {
    expect(burstTimes(4, 0.1, 0).map((t) => +t.toFixed(9))).toEqual([0, 0.1, 0.2, 0.3]);
    expect(burstTimes(4, 0.1, 1).map((t) => +t.toFixed(9))).toEqual([0, 0.1, 0.15, 0.175]);
    expect(burstTimes(3, 0.1, -1).map((t) => +t.toFixed(9))).toEqual([0, 0.1, 0.3]);
  });
});

describe('Burst', () => {
  it('un trigger → una raffica, con la velocity che cala', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events: [{ kind: 'trig', t: 0.2, voice: 0, vel: 1 }] } },
        { id: 'b', module: 'burst', params: { count: 4, rate: 0.1, accel: 0, decay: 0.5 } },
      ],
      [{ from: 'src.out', to: 'b.trig' }],
      ['b.trig'],
    );
    sim.runTo(1);
    const ev = sim.events('b.trig') as { t: number; vel: number }[];
    expect(ev.map((e) => +e.t.toFixed(6))).toEqual([0.2, 0.3, 0.4, 0.5]);
    expect(ev.map((e) => e.vel)).toEqual([1, 0.5, 0.25, 0.125]);
  });
});
