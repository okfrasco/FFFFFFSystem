import { describe, expect, it } from 'vitest';
import { scaleOffset } from './index';

describe('Scale / Offset', () => {
  it('scala, sposta, inverte', () => {
    expect(scaleOffset(0.5, 2, 0.1, 0)).toBeCloseTo(1.1, 9);
    expect(scaleOffset(0.2, 1, 0, 1)).toBeCloseTo(0.8, 9);
    expect(scaleOffset(0.2, 1, 0, 2)).toBeCloseTo(-0.2, 9);
  });
});
