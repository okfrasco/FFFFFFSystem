import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { caStep } from './index';

describe('caStep', () => {
  it('regola 90 da una cella: il triangolo di Sierpinski', () => {
    let row: number[] = [0, 0, 0, 1, 0, 0, 0];
    const rows = [row.join('')];
    for (let i = 0; i < 3; i++) rows.push((row = caStep(row, 90)).join(''));
    expect(rows).toEqual(['0001000', '0010100', '0100010', '1010101']);
  });

  it('regola 30: la cella centrale non è periodica nei primi passi', () => {
    let row: number[] = Array.from({ length: 31 }, (_, i) => (i === 15 ? 1 : 0));
    const center: number[] = [];
    for (let i = 0; i < 16; i++) {
      center.push(row[15]!);
      row = caStep(row, 30);
    }
    expect(center.join('')).toBe('1101110011000101');
  });
});

describe('Automa 1D', () => {
  it('un trigger quando la cella letta è viva, e la riga come gate poly', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'a', module: 'ca1d', params: { rule: 30, width: 31, cell: 15, voices: 16, steps: 16 } }],
      [{ from: 'tr.bar', to: 'a.phase' }],
      ['a.trig', 'a.row'],
    );
    sim.runTo(0.5);
    // regola 30, cella centrale dalla generazione 1: 1 0 1 1 1 0 0 1 → colpi agli step 0, 2, 3, 4, 7
    expect(sim.events('a.trig').map((e) => Math.round(e.t / 0.125))).toEqual([0, 2, 3, 4, 7]);
    expect(sim.values('a.row').at(-1)).toHaveLength(16);
  });
});
