import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate } from '../../../../tests/helpers/sim';
import { lifeStep } from './index';

describe('lifeStep', () => {
  it('il lampeggiatore oscilla, il blocco resta fermo', () => {
    const blinker = [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    const next = lifeStep(blinker);
    expect(next[2]).toEqual([0, 1, 1, 1, 0]);
    expect(lifeStep(next)).toEqual(blinker);
    const block = [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ];
    expect(lifeStep(block)).toEqual(block);
  });
});

describe('Game of Life', () => {
  it('legge una colonna per step: righe = voci; riproducibile e sempre viva', () => {
    const run = (seed: number) => {
      const sim = simulate(
        [TRANSPORT, { id: 'l', module: 'life', params: { width: 8, height: 6 } }],
        [{ from: 'tr.bar', to: 'l.phase' }],
        ['l.trig', 'l.density'],
        seed,
      );
      sim.runTo(16);
      return sim;
    };
    const a = run(3);
    expect(compact(a.events('l.trig'))).toEqual(compact(run(3).events('l.trig')));
    expect(compact(a.events('l.trig'))).not.toEqual(compact(run(4).events('l.trig')));
    expect(a.events('l.trig').every((e) => e.voice < 6)).toBe(true);
    // si riparte da sola quando si spegne: in 16 battute c'è sempre qualcosa da suonare
    const perBar = Array.from({ length: 16 }, (_, b) => a.events('l.trig').filter((e) => Math.floor(e.t / 2) === b).length);
    expect(perBar.filter((x) => x > 0).length).toBeGreaterThan(12);
  });
});
