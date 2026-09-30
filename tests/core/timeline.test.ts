import { describe, expect, it } from 'vitest';
import { Timeline } from '../../src/core/timeline';

describe('Timeline', () => {
  it('interpola tra campioni e tiene i bordi', () => {
    const tl = new Timeline(8);
    expect(tl.sample(0)).toBe(0);
    tl.push(1, [10]);
    tl.push(2, [20]);
    tl.push(4, [0]);
    expect(tl.sample(1.5)).toBeCloseTo(15);
    expect(tl.sample(3)).toBeCloseTo(10);
    expect(tl.sample(0)).toBe(10);
    expect(tl.sample(9)).toBe(0);
    expect(tl.range()).toEqual([1, 4]);
  });

  it('come ring buffer tiene solo gli ultimi campioni', () => {
    const tl = new Timeline(4);
    for (let t = 0; t < 10; t++) tl.push(t, [t * 2]);
    expect(tl.size).toBe(4);
    expect(tl.range()).toEqual([6, 9]);
    expect(tl.sample(7.5)).toBeCloseTo(15);
    expect(tl.sample(0)).toBe(12);
  });

  it('una colonna per voce, con fallback alla voce 0', () => {
    const tl = new Timeline(4, 3);
    tl.push(0, [1, 2, 3]);
    tl.push(1, [5]);
    expect(tl.sample(0, 2)).toBe(3);
    expect(tl.sample(1, 2)).toBe(5);
    expect(tl.sample(0.5, 1)).toBeCloseTo(3.5);
  });

  it('mantiene la precisione della fase srotolata dopo molte battute', () => {
    const tl = new Timeline(4);
    tl.push(0, [123456.25]);
    expect(tl.sample(0)).toBe(123456.25);
  });
});
