import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { pcsOfMask } from '../theory';

const walk = (params: Record<string, number>, bars: number) => {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 1 } }, { id: 'q', module: 'fifths', params }],
    [
      { from: 'tr.bar', to: 'c.phase' },
      { from: 'c.trig', to: 'q.trig' },
    ],
    ['q.scale', 'q.root', 'q.change'],
  );
  sim.runTo(bars);
  return sim;
};

describe('Cerchio delle quinte', () => {
  it('per quinte: Do, Sol, Re, La', () => {
    const sim = walk({ root: 0, mode: 1, walk: 0, step: 1 }, 3.5);
    expect(sim.events('q.change').map((e) => (e.kind === 'trig' ? e.value : -1))).toEqual([7, 2, 9, 4]);
    expect(pcsOfMask(sim.values('q.scale').at(-1)!)).toEqual([1, 3, 4, 6, 8, 9, 11]); // Mi maggiore
  });

  it('per brightness: da Do ionio sette passi più scuro arriva a Si ionio', () => {
    const sim = walk({ root: 0, mode: 1, walk: 1, step: 1 }, 6.5);
    expect(sim.values('q.root').at(-1)).toEqual([11]);
    expect(pcsOfMask(sim.values('q.scale').at(-1)!)).toEqual([1, 3, 4, 6, 8, 10, 11]);
  });
});
