import { describe, expect, it } from 'vitest';
import { mod, phaseAt, stepCrossings } from '../../src/core/phase';

describe('stepCrossings', () => {
  it('trova gli step e il loro istante esatto', () => {
    // 4 step per ciclo, fase da 0.2 a 0.8 in [0, 1]: entra negli step 1 (0.25) e 2 (0.5), 3 (0.75)
    const hits = stepCrossings(0.2, 0.8, 4, 0, 1);
    expect(hits.map((h) => h.step)).toEqual([1, 2, 3]);
    expect(hits.map((h) => +h.t.toFixed(9))).toEqual([0.083333333, 0.5, 0.916666667]);
  });

  it('un confine tra due tick scatta una sola volta, e lo step 0 a fase 0', () => {
    const a = stepCrossings(0, 0.25, 4, 0, 1);
    const b = stepCrossings(0.25, 0.5, 4, 1, 2);
    expect(a.map((h) => h.step)).toEqual([0]);
    expect(b.map((h) => h.step)).toEqual([1]);
    expect(b[0]!.t).toBe(1);
  });

  it('copre tutti gli step su molti tick senza buchi né doppioni', () => {
    const steps: number[] = [];
    const dt = 0.0137;
    for (let k = 0; k < 1000; k++) {
      for (const h of stepCrossings(k * dt, (k + 1) * dt, 16, k, k + 1, 0.3)) steps.push(h.step);
    }
    expect(steps).toEqual(Array.from({ length: steps.length }, (_, i) => i));
    expect(steps.length).toBe(Math.ceil(1000 * dt * 16));
  });

  it('lo swing sposta solo gli step dispari', () => {
    // 2 step per ciclo, swing 2/3 (terzina): lo step 1 cade a 1 + 1/3 step = 2/3 del ciclo
    const hits = stepCrossings(0, 1, 2, 0, 1, 2 / 3);
    expect(hits.map((h) => h.step)).toEqual([0, 1]);
    expect(hits[1]!.t).toBeCloseTo(2 / 3, 12);
    const early = stepCrossings(0, 1, 2, 0, 1, -1);
    expect(early[1]!.t).toBeCloseTo(0.25, 12);
  });

  it('al contrario entra negli step in ordine decrescente', () => {
    const hits = stepCrossings(1, 0.3, 4, 0, 1);
    expect(hits.map((h) => h.step)).toEqual([3, 2, 1]);
    expect(hits[0]!.t).toBe(0);
    expect(hits.every((h, i) => i === 0 || h.t > hits[i - 1]!.t)).toBe(true);
  });

  it('fase ferma o steps nulli: nessuno step', () => {
    expect(stepCrossings(0.5, 0.5, 4, 0, 1)).toEqual([]);
    expect(stepCrossings(0, 1, 0, 0, 1)).toEqual([]);
  });
});

describe('phaseAt / mod', () => {
  it('interpolano e avvolgono', () => {
    expect(phaseAt(1, 2, 10, 11, 10.25)).toBe(1.25);
    expect(mod(-1, 4)).toBe(3);
    expect(mod(9, 4)).toBe(1);
  });
});
