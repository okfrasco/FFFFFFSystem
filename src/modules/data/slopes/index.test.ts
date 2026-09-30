import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { readSlopes, shape, type SlopePoint } from './index';

const PTS: SlopePoint[] = [
  [0, 0, 0],
  [0.5, 1, 1],
  [0.75, 0.5, 0],
];

describe('readSlopes', () => {
  it('rampe tra i punti, con la curvatura e il ritorno al primo punto', () => {
    expect(readSlopes(PTS, 0.25)).toBeCloseTo(0.5, 9);
    expect(readSlopes(PTS, 0.625)).toBeCloseTo(1 - 0.5 * shape(0.5, 1), 9); // parte lenta
    expect(shape(0.5, 1)).toBeCloseTo(0.0625, 9);
    expect(readSlopes(PTS, 0.875)).toBeCloseTo(0.25, 9); // da 0.5 torna a 0 al ciclo dopo
    expect(readSlopes(PTS, 1.25)).toBeCloseTo(0.5, 9);
  });

  it('funziona anche se il primo punto non è a zero', () => {
    const pts: SlopePoint[] = [
      [0.25, 1, 0],
      [0.75, 0, 0],
    ];
    expect(readSlopes(pts, 0.5)).toBeCloseTo(0.5, 9);
    expect(readSlopes(pts, 0)).toBeCloseTo(0.5, 9); // tra 0.75 e 1.25
  });
});

describe('Slopes', () => {
  it('un trigger per punto attraversato, con l indice', () => {
    const sim = simulate([TRANSPORT, { id: 's', module: 'slopes', config: { points: PTS } }], [{ from: 'tr.bar', to: 's.phase' }], ['s.trig', 's.out']);
    sim.runTo(1);
    expect(sim.events('s.trig').map((e) => [e.t, e.kind === 'trig' ? e.value : -1])).toEqual([
      [0, 0],
      [1, 1],
      [1.5, 2],
    ]);
  });
});
