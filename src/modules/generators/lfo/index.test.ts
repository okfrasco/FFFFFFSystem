import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';
import { lfoShape } from './index';

function run(params: Record<string, number>, bars = 1) {
  const sim = simulate([TRANSPORT, { id: 'l', module: 'lfo', params }], [{ from: 'tr.bar', to: 'l.phase' }], ['l.out', 'l.trig']);
  sim.runTo(bars);
  // valore a ogni quarto di battuta: tick 100, 200, 300 (fine tick = 0.5 s, 1 s, 1.5 s)
  const at = (tick: number) => sim.values('l.out')[tick - 1]![0]!;
  return { sim, at };
}

describe('lfoShape', () => {
  it('forme base tra 0 e 1', () => {
    expect([0, 0.25, 0.5, 0.75].map((u) => +lfoShape(0, u, 0.5).toFixed(6))).toEqual([0, 0.5, 1, 0.5]);
    expect([0, 0.25, 0.5, 0.75].map((u) => lfoShape(1, u, 0.5))).toEqual([0, 0.5, 1, 0.5]);
    expect(lfoShape(1, 0.2, 0.2)).toBeCloseTo(1, 9); // skew: il picco si sposta
    expect(lfoShape(2, 0.3, 0.5)).toBe(0.3);
    expect(lfoShape(3, 0.3, 0.5)).toBe(0.7);
    expect([0.1, 0.6].map((u) => lfoShape(4, u, 0.5))).toEqual([1, 0]);
  });
});

describe('LFO', () => {
  it('agganciato alla fase: un triangolo per battuta passa per il picco a metà battuta', () => {
    const { at } = run({ shape: 1, cycles: 1 });
    expect(at(100)).toBeCloseTo(0.5, 6);
    expect(at(200)).toBeCloseTo(1, 6);
    expect(at(300)).toBeCloseTo(0.5, 6);
  });

  it('cicli 4 = uno per beat, con un trigger a ogni ciclo', () => {
    const { sim } = run({ shape: 2, cycles: 4 }, 2);
    expect(sim.events('l.trig').map((e) => stepOf(e.t, 4))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('offset e polarità', () => {
    expect(run({ shape: 2, cycles: 1, offset: 0.5 }).at(100)).toBeCloseTo(0.75, 6);
    expect(run({ shape: 2, cycles: 1, polarity: 1 }).at(200)).toBeCloseTo(0, 6);
  });
});
