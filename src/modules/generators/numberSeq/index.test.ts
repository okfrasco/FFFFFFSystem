import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { seqMember, seqValue } from './index';

describe('seqValue / seqMember', () => {
  it('Fibonacci, primi, triangolari, quadrati, Collatz, lista', () => {
    const first = (k: number, m = 1000) => Array.from({ length: 8 }, (_, n) => seqValue(k, n, m, [5, 6]));
    expect(first(0)).toEqual([0, 1, 1, 2, 3, 5, 8, 13]);
    expect(first(1)).toEqual([2, 3, 5, 7, 11, 13, 17, 19]);
    expect(first(2)).toEqual([0, 1, 3, 6, 10, 15, 21, 28]);
    expect(first(3)).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
    expect(first(4)).toEqual([0, 1, 7, 2, 5, 8, 16, 3]);
    expect(first(5)).toEqual([5, 6, 5, 6, 5, 6, 5, 6]);
    expect(seqValue(0, 90, 10, [])).toBe(0); // F(90) finisce per 0: Fibonacci mod 10 ha periodo 60
    expect(Array.from({ length: 20 }, (_, n) => n).filter((n) => seqMember(1, n))).toEqual([2, 3, 5, 7, 11, 13, 17, 19]);
  });

  it('i primi restano veloci anche dopo migliaia di step', () => {
    const t = Date.now();
    seqValue(1, 5000, 12, []);
    expect(Date.now() - t).toBeLessThan(500);
  });
});

describe('Sequenza numerica', () => {
  it('modo appartenenza: i primi come ritmo', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'q', module: 'numberSeq', params: { sequence: 1, rhythm: 1, steps: 16 } }],
      [{ from: 'tr.bar', to: 'q.phase' }],
      ['q.trig'],
    );
    sim.runTo(1);
    expect(sim.events('q.trig').map((e) => Math.round(e.t / 0.125))).toEqual([2, 3, 5, 7, 11, 13]);
  });
});
