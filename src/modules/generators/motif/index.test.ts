import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { transformCell } from './index';

describe('transformCell', () => {
  const cell = [0, 2, null, 4];
  it('trasposizione, inversione, retrogrado, spostamento, abbellimento', () => {
    expect(transformCell(cell, 1, 3)).toEqual([3, 5, null, 7]);
    expect(transformCell(cell, 2, 0)).toEqual([0, -2, null, -4]);
    expect(transformCell(cell, 3, 0)).toEqual([4, null, 2, 0]);
    expect(transformCell(cell, 4, 0)).toEqual([4, 0, 2, null]);
    expect(transformCell(cell, 5, 1)).toEqual([0, 2, 3, 4]);
  });
});

describe('Motif', () => {
  const run = (params: Record<string, number>) => {
    const sim = simulate([TRANSPORT, { id: 'm', module: 'motif', params: { length: 4, steps: 16, rests: 0, ...params } }], [{ from: 'tr.bar', to: 'm.phase' }], ['m.trig']);
    sim.runTo(2);
    const vals = sim.events('m.trig').map((e) => (e as { value: number }).value);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((r) => vals.slice(r * 4, r * 4 + 4).join());
  };

  it('ritorno a ogni ripetizione: il motivo resta sempre uguale', () => {
    expect(new Set(run({ variation: 1, return: 1 })).size).toBe(1);
  });

  it('con variazione e ritorno ogni 4: varianti, e l\'originale ogni 4 ripetizioni', () => {
    const reps = run({ variation: 1, return: 4 });
    expect(new Set(reps).size).toBeGreaterThan(2);
    expect(reps[4]).toBe(reps[0]);
  });
});
