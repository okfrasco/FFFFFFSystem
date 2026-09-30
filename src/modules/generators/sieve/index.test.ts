import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { parseSieve } from './index';

const first = (expr: string, n = 16) => Array.from({ length: n }, (_, i) => i).filter(parseSieve(expr));

describe('parseSieve', () => {
  it('classi di resto, unione, intersezione, complemento, gruppi', () => {
    expect(first('3@0')).toEqual([0, 3, 6, 9, 12, 15]);
    expect(first('3@0 | 4@1')).toEqual([0, 1, 3, 5, 6, 9, 12, 13, 15]);
    expect(first('2@0 & 3@0')).toEqual([0, 6, 12]);
    expect(first('~2@0')).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
    expect(first('(3@0 | 4@1) & ~5@2')).toEqual([0, 1, 3, 5, 6, 9, 13, 15]);
  });

  it('errori con la posizione', () => {
    expect(() => parseSieve('3@')).toThrow(/numero/);
    expect(() => parseSieve('(3@0')).toThrow(/\)/);
    expect(() => parseSieve('0@1')).toThrow(/modulo/);
    expect(() => parseSieve('3@0 x')).toThrow(/inatteso/);
  });
});

describe('Setaccio', () => {
  it('conta gli step dall\'inizio, anche oltre il ciclo', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'sieve', params: { division: 4 }, config: { expr: '5@0' } }],
      [{ from: 'tr.bar', to: 's.phase' }],
      ['s.trig'],
    );
    sim.runTo(4); // 16 quarti
    expect(sim.events('s.trig').map((e) => Math.round(e.t / 0.5))).toEqual([0, 5, 10, 15]);
  });

  it('un\'espressione non valida tace invece di rompersi', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'sieve', config: { expr: '3@' } }],
      [{ from: 'tr.bar', to: 's.phase' }],
      ['s.trig'],
    );
    sim.runTo(1);
    expect(sim.events('s.trig')).toEqual([]);
  });
});
