import { describe, expect, it } from 'vitest';
import { mapCurve } from './index';

describe('Curve map', () => {
  it('interpola tra i punti, estremi compresi, e tiene i bordi', () => {
    const p = [0, 0.5, 1];
    expect(mapCurve(p, 0)).toBe(0);
    expect(mapCurve(p, 0.25)).toBeCloseTo(0.25, 9);
    expect(mapCurve(p, 1)).toBe(1);
    expect(mapCurve(p, 2)).toBe(1);
    expect(mapCurve([0.3], 0.7)).toBe(0.3);
  });
});
