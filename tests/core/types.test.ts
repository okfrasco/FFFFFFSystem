import { describe, expect, it } from 'vitest';
import { crossingTime, frac, voiceCount } from '../../src/core/types';

describe('frac', () => {
  it('parte frazionaria, anche per valori negativi', () => {
    expect(frac(3.25)).toBeCloseTo(0.25);
    expect(frac(-0.25)).toBeCloseTo(0.75);
    expect(frac(2)).toBe(0);
  });
});

describe('crossingTime', () => {
  it('interpola l\'istante in cui la fase passa per il target', () => {
    // fase da 0.9 a 1.1 in [10, 10.01]: passa per 1.0 a metà tick
    expect(crossingTime(0.9, 1.1, 1, 10, 10.01)).toBeCloseTo(10.005, 9);
  });

  it('funziona anche con fase che scende', () => {
    expect(crossingTime(2.2, 1.8, 2, 0, 1)).toBeCloseTo(0.5, 9);
  });

  it('NaN se il target è fuori o la fase è ferma', () => {
    expect(crossingTime(0.1, 0.2, 0.5, 0, 1)).toBeNaN();
    expect(crossingTime(0.5, 0.5, 0.5, 0, 1)).toBeNaN();
  });
});

describe('voiceCount', () => {
  it('legge il numero di voci da ogni tipo di buffer', () => {
    expect(voiceCount({ type: 'phase', start: new Float64Array(3), end: new Float64Array(3) })).toBe(3);
    expect(voiceCount({ type: 'control', values: new Float32Array(4), events: [] })).toBe(4);
    expect(voiceCount({ type: 'audio', channels: [new Float32Array(8), new Float32Array(8)] })).toBe(2);
    expect(voiceCount({ type: 'texture', width: 1, height: 1, handle: null })).toBe(1);
  });
});
