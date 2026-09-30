import { describe, expect, it } from 'vitest';
import { foldWrap } from './index';

describe('Fold / Wrap', () => {
  it('ripiega, avvolge, taglia', () => {
    expect(foldWrap(1.2, 0, 1, 0)).toBeCloseTo(0.8, 9);
    expect(foldWrap(-0.3, 0, 1, 0)).toBeCloseTo(0.3, 9);
    expect(foldWrap(2.5, 0, 1, 0)).toBeCloseTo(0.5, 9);
    expect(foldWrap(1.2, 0, 1, 1)).toBeCloseTo(0.2, 9);
    expect(foldWrap(-0.3, 0, 1, 1)).toBeCloseTo(0.7, 9);
    expect(foldWrap(1.2, 0, 1, 2)).toBe(1);
    expect(foldWrap(0.5, 0.4, 0.4, 0)).toBe(0.4);
  });
});
