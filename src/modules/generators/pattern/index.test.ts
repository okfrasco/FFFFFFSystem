import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';
import { GENRES } from '../rhythm/genres';

describe('Pattern', () => {
  it('senza variazione suona la linea del genere, trasposta', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'p', module: 'pattern', params: { genre: 3, role: 0, variation: 0, transpose: 2 } }],
      [{ from: 'tr.bar', to: 'p.phase' }],
      ['p.trig'],
    );
    sim.runTo(1);
    const line = GENRES[3]!.bass;
    const expected = line.flatMap((d, i) => (d === null ? [] : [[i, d + 2]]));
    expect(sim.events('p.trig').map((e) => [stepOf(e.t), (e as { value: number }).value])).toEqual(expected);
  });
});
