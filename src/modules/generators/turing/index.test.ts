import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { registerValue } from './index';

function values(params: Record<string, number>, bars: number, seed = 1) {
  const sim = simulate([TRANSPORT, { id: 't', module: 'turing', params }], [{ from: 'tr.bar', to: 't.phase' }], ['t.out', 't.trig'], seed);
  const perStep: number[] = [];
  // un valore per step (16 per battuta = ogni 25 tick), letto a metà step
  sim.runTo(bars);
  const vals = sim.values('t.out');
  for (let i = 12; i < vals.length; i += 25) perStep.push(+vals[i]![0]!.toFixed(6));
  return { perStep, sim };
}

describe('registerValue', () => {
  it('legge i primi 8 bit come numero, il primo più significativo', () => {
    expect(registerValue([1, 0, 0, 0, 0, 0, 0, 0])).toBeCloseTo(128 / 255, 9);
    expect(registerValue([1, 1, 1, 1, 1, 1, 1, 1])).toBe(1);
    expect(registerValue([0, 1])).toBeCloseTo(0b01010101 / 255, 9); // meno di 8 bit: si ripetono
  });
});

describe('Turing Machine', () => {
  it('change 0: loop bloccato, si ripete ogni `length` step', () => {
    const { perStep } = values({ length: 8, change: 0 }, 4);
    for (let i = 8; i < perStep.length; i++) expect(perStep[i]).toBe(perStep[i - 8]);
  });

  it('change 1: il loop si inverte a ogni giro, quindi si ripete ogni 2·length', () => {
    const { perStep } = values({ length: 5, change: 1 }, 4);
    for (let i = 10; i < perStep.length; i++) expect(perStep[i]).toBe(perStep[i - 10]);
    expect(perStep.slice(0, 5)).not.toEqual(perStep.slice(5, 10));
  });

  it('change basso: per lo più ripete, ogni tanto cambia', () => {
    const { perStep } = values({ length: 8, change: 0.1 }, 16, 4);
    let same = 0;
    for (let i = 8; i < perStep.length; i++) if (perStep[i] === perStep[i - 8]) same++;
    const share = same / (perStep.length - 8);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.95);
  });

  it('seed diverso, registro iniziale diverso', () => {
    expect(values({ change: 0 }, 1, 1).perStep).not.toEqual(values({ change: 0 }, 1, 2).perStep);
  });

  it('trigger quando il primo bit è 1', () => {
    const { sim } = values({ length: 8, change: 0 }, 2);
    const trigs = sim.events('t.trig').length;
    expect(trigs).toBeGreaterThan(0);
    expect(trigs).toBeLessThan(32);
  });
});
