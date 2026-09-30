import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { readTable, type Table2dConfig } from './index';

const T: Table2dConfig = { w: 2, h: 2, cells: [0, 1, 0.5, 0.25] };

describe('readTable', () => {
  it('cella per cella, e bilineare con smooth', () => {
    expect(readTable(T, 0.25, 0.25, 0)).toBe(0);
    expect(readTable(T, 0.75, 0.25, 0)).toBe(1);
    expect(readTable(T, 0.25, 0.75, 0)).toBe(0.5);
    expect(readTable(T, 0.25, 0, 1)).toBeCloseTo(0.5, 9); // a metà della cella (0,0), verso la (1,0)
  });
});

describe('Tabella 2D', () => {
  it('X alla battuta, Y a due battute: percorre la matrice riga per riga', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'phaseScale', params: { num: 1, den: 2 } }, { id: 't', module: 'table2d', config: T }],
      [
        { from: 'tr.bar', to: 's.in' },
        { from: 'tr.bar', to: 't.x' },
        { from: 's.out', to: 't.y' },
      ],
      ['t.trig'],
    );
    sim.runTo(2);
    expect(sim.events('t.trig').map((e) => [e.t, e.kind === 'trig' ? e.value : -1])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0.5],
      [3, 0.25],
    ]);
  });
});
