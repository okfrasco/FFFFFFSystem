import { describe, expect, it } from 'vitest';
import { ParamStore, denormalize, normalize, validateParamSpec } from '../../src/core/params';
import type { ParamSpec } from '../../src/core/types';

const lin: ParamSpec = { id: 'lin', min: -2, max: 6, default: 0, kind: 'continuous' };
const exp: ParamSpec = { id: 'cut', min: 20, max: 20000, default: 1000, kind: 'continuous', curve: 'exp' };
const disc: ParamSpec = { id: 'steps', min: 1, max: 16, default: 8, kind: 'discrete' };

describe('normalize / denormalize', () => {
  it('lineare: andata e ritorno', () => {
    expect(normalize(lin, 2)).toBeCloseTo(0.5);
    expect(denormalize(lin, 0.25)).toBeCloseTo(0);
    for (const v of [-2, -1.3, 0, 4.4, 6]) expect(denormalize(lin, normalize(lin, v))).toBeCloseTo(v, 9);
  });

  it('esponenziale: metà corsa = media geometrica', () => {
    expect(denormalize(exp, 0.5)).toBeCloseTo(Math.sqrt(20 * 20000), 6);
    expect(normalize(exp, 200)).toBeCloseTo(1 / 3, 9);
    for (const v of [20, 55, 1000, 20000]) expect(denormalize(exp, normalize(exp, v))).toBeCloseTo(v, 6);
  });

  it('i discreti si arrotondano, tutto fa clamp', () => {
    expect(denormalize(disc, 0.5)).toBe(9); // 8.5 → 9
    expect(denormalize(disc, 0.49)).toBe(8);
    expect(denormalize(lin, 2)).toBe(6);
    expect(denormalize(lin, -1)).toBe(-2);
    expect(normalize(lin, 100)).toBe(1);
    expect(normalize(exp, 0)).toBe(0); // log(0) → clamp
  });
});

describe('validateParamSpec', () => {
  it('segnala le definizioni sbagliate', () => {
    expect(validateParamSpec(lin)).toEqual([]);
    expect(validateParamSpec({ ...lin, max: -5 })[0]).toMatch(/max < min/);
    expect(validateParamSpec({ ...lin, default: 9 })[0]).toMatch(/default/);
    expect(validateParamSpec({ ...exp, min: 0, default: 0 })[0]).toMatch(/exp/);
    expect(validateParamSpec({ id: 'o', min: 0, max: 1, default: 0, kind: 'discrete', options: ['a', 'b', 'c'] })[0]).toMatch(/options/);
  });
});

describe('ParamStore', () => {
  it('parte dai valori iniziali, poi dai default', () => {
    const s = new ParamStore([lin, disc], { steps: 12 });
    expect(s.getBase('lin')).toBeCloseTo(0);
    expect(s.getBase('steps')).toBe(12);
    expect(s.snapshot()).toEqual({ lin: expect.closeTo(0), steps: 12 });
  });

  it('rifiuta id sconosciuti', () => {
    expect(() => new ParamStore([lin], { nope: 1 })).toThrow(/nope/);
    expect(() => new ParamStore([lin]).value('nope')).toThrow(/nope/);
  });

  it('somma le modulazioni con amount e fa clamp', () => {
    const s = new ParamStore([lin], { lin: 2 }); // normalizzato 0.5
    const src = { type: 'control' as const, values: new Float32Array([0.5]), events: [] };
    s.addModulation('lin', { source: () => src, amount: 0.4 });
    s.addModulation('lin', { source: () => src, amount: -0.2 });
    expect(s.normalized('lin')).toBeCloseTo(0.6, 6);
    src.values[0] = 10;
    expect(s.normalized('lin')).toBe(1);
  });
});
