import { describe, expect, it } from 'vitest';
import { fastSin } from './dsp';
import { additiveCycle, fft } from './fft';

describe('fft', () => {
  it('andata e ritorno', () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i) + i / 10);
    const im = new Float64Array(64);
    const orig = [...re];
    fft(re, im);
    fft(re, im, true);
    re.forEach((x, i) => expect(x).toBeCloseTo(orig[i]!, 9));
  });

  it('un seno puro sta in un solo bin', () => {
    const n = 32;
    const re = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const mag = [...re].map((r, i) => Math.hypot(r, im[i]!));
    expect(mag[3]).toBeCloseTo(n / 2, 6);
    expect(mag[5]).toBeCloseTo(0, 6);
  });

  it('additiveCycle ricostruisce la somma di seni', () => {
    const c = additiveCycle([1, 0, 0.5], 256);
    for (const i of [0, 17, 100]) expect(c[i]).toBeCloseTo(Math.sin((2 * Math.PI * i) / 256) + 0.5 * Math.sin((2 * Math.PI * 3 * i) / 256), 6);
  });

  it('fastSin', () => {
    for (const p of [0, 0.1, 0.25, 0.7, 3.3, -0.2]) expect(fastSin(p)).toBeCloseTo(Math.sin(2 * Math.PI * p), 5);
  });
});
