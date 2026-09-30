import { describe, expect, it } from 'vitest';
import { LSYSTEM_MAX_LENGTH, expandLSystem, type LSystemConfig } from './index';
import { TRANSPORT, compact, simulate, stepOf } from '../../../../tests/helpers/sim';

function run(config: LSystemConfig, params: Record<string, number>, bars = 2, seed = 1) {
  const sim = simulate(
    [TRANSPORT, { id: 'ls', module: 'lsystem', params, config }],
    [{ from: 'tr.bar', to: 'ls.phase' }],
    ['ls.trig'],
    seed,
  );
  sim.runTo(bars);
  return sim.events('ls.trig') as { t: number; value: number; vel: number }[];
}

describe('expandLSystem', () => {
  it('espande le regole (Fibonacci) e si ferma al limite', () => {
    const fib = { axiom: 'A', rules: { A: 'AB', B: 'A' } };
    expect([0, 1, 2, 3, 4, 5].map((i) => expandLSystem(fib, i).length)).toEqual([1, 2, 3, 5, 8, 13]);
    expect(expandLSystem(fib, 3)).toBe('ABAAB');
    expect(expandLSystem({ axiom: 'F', rules: { F: 'FFF' } }, 20).length).toBe(LSYSTEM_MAX_LENGTH);
  });
});

describe('L-system', () => {
  it('legge la stringa come una melodia a tartaruga, che riparte a ogni passata', () => {
    const ev = run({ axiom: 'F+F-F[+F]F', rules: {} }, { iterations: 0, steps: 8 }, 1);
    expect(ev.map((e) => e.value)).toEqual([0, 1, 0, 1, 0, 0, 1, 0]);
    expect(ev.map((e) => e.vel)).toEqual([1, 1, 1, 0.85, 1, 1, 1, 1]);
  });

  it('le pause consumano uno step', () => {
    const ev = run({ axiom: 'F.F', rules: {} }, { iterations: 0, steps: 8 }, 1);
    expect(ev.map((e) => stepOf(e.t, 8))).toEqual([0, 2, 3, 5, 6]);
  });

  it('le iterazioni cambiano la frase', () => {
    const cfg = { axiom: 'F', rules: { F: 'F+F' } };
    expect(run(cfg, { iterations: 2, steps: 8 }, 1).map((e) => e.value)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('mutazione riproducibile a seed fisso', () => {
    const cfg = { axiom: 'F', rules: { F: 'F+F-[-F.F]+F' } };
    const a = run(cfg, { iterations: 3, steps: 16, mutation: 0.2 }, 8, 5);
    expect(compact(a as never)).toEqual(compact(run(cfg, { iterations: 3, steps: 16, mutation: 0.2 }, 8, 5) as never));
    expect(compact(a as never).slice(0, 32)).toMatchSnapshot();
  });
});
