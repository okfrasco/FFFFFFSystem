import { describe, expect, it } from 'vitest';
import { Rng, hash01, hash32, hashString } from '../../src/core/rng';

const take = (r: Rng, n: number): number[] => Array.from({ length: n }, () => r.nextUint32());

describe('Rng', () => {
  it('coincide con il riferimento C di xoshiro128** (stato 1,2,3,4)', () => {
    const r = Rng.fromState(0, [1, 2, 3, 4]);
    expect(take(r, 6)).toEqual([11520, 0, 5927040, 70819200, 2031721883, 1637235492]);
  });

  it('coincide con il riferimento C per il seed 42 (splitmix32 → xoshiro128**)', () => {
    const r = new Rng(42);
    expect(r.getState()).toEqual([939911724, 3948730756, 321366731, 3317318717]);
    expect(take(r, 6)).toEqual([2837322924, 544945897, 479756282, 3500138142, 339756180, 113173290]);
  });

  it('stesso seed → stessa sequenza, seed diverso → sequenza diversa', () => {
    expect(take(new Rng(7), 100)).toEqual(take(new Rng(7), 100));
    expect(take(new Rng(7), 100)).not.toEqual(take(new Rng(8), 100));
  });

  it('riprende esattamente dallo stato salvato', () => {
    const a = new Rng(123);
    take(a, 37);
    const saved = a.getState();
    const expected = take(a, 50);
    const b = Rng.fromState(123, JSON.parse(JSON.stringify(saved)));
    expect(take(b, 50)).toEqual(expected);
  });

  it('fork dipende da seed e label, non da quanto il padre ha consumato', () => {
    const p1 = new Rng(99);
    const p2 = new Rng(99);
    take(p2, 1000);
    expect(take(p1.fork('euclid'), 20)).toEqual(take(p2.fork('euclid'), 20));
    expect(take(p1.fork('euclid'), 20)).not.toEqual(take(p1.fork('markov'), 20));
    expect(take(p1.fork(1), 20)).not.toEqual(take(p1.fork(2), 20));
    expect(take(p1.fork('x'), 20)).not.toEqual(take(p1, 20));
  });

  it('float è in [0, 1) e ben distribuito', () => {
    const r = new Rng(2024);
    const n = 100_000;
    const buckets = new Array<number>(10).fill(0);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x = r.float();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
      buckets[Math.floor(x * 10)]!++;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
    // chi-quadro con 9 gradi di libertà: p=0.001 → 27.88
    const exp = n / 10;
    const chi = buckets.reduce((acc, b) => acc + (b - exp) ** 2 / exp, 0);
    expect(chi).toBeLessThan(27.88);
  });

  it('int rispetta i limiti e li raggiunge tutti', () => {
    const r = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-3, 4);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(r.int(5, 5)).toBe(5);
  });

  it('chance ai bordi e in media', () => {
    const r = new Rng(11);
    let hits = 0;
    for (let i = 0; i < 20_000; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
      if (r.chance(0.3)) hits++;
    }
    expect(hits / 20_000).toBeCloseTo(0.3, 1);
  });

  it('weighted segue i pesi e ignora quelli nulli', () => {
    const r = new Rng(3);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[r.weighted([1, 0, 3])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.7);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.3);
    expect(r.weighted([0, 0])).toBe(-1);
  });

  it('pick e gaussian', () => {
    const r = new Rng(8);
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
    expect(() => r.pick([])).toThrow();
    let s = 0;
    let s2 = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const g = r.gaussian();
      s += g;
      s2 += g * g;
    }
    expect(s / n).toBeCloseTo(0, 1);
    expect(s2 / n).toBeCloseTo(1, 1);
  });

  it('lo stato zero non blocca il generatore', () => {
    const r = Rng.fromState(0, [0, 0, 0, 0]);
    expect(take(r, 10).some((x) => x !== 0)).toBe(true);
  });

  it('rifiuta seed non finiti', () => {
    expect(() => new Rng(NaN)).toThrow();
  });
});

describe('hash', () => {
  it('è deterministico e sensibile a ordine e lunghezza', () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(3, 2, 1));
    expect(hash32(1, 2)).not.toBe(hash32(1, 2, 0));
    expect(hashString('seed')).toBe(hashString('seed'));
    expect(hashString('seed')).not.toBe(hashString('seeds'));
  });

  it('hash01 è uniforme su chiavi consecutive (soglie di morph)', () => {
    // Le chiavi di evento sono spesso indici consecutivi: devono dare soglie sparse.
    const n = 50_000;
    let below = 0;
    for (let k = 0; k < n; k++) {
      const u = hash01(42, 7, k);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      if (u < 0.5) below++;
    }
    expect(below / n).toBeCloseTo(0.5, 1);
  });
});
