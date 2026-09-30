import { describe, expect, it } from 'vitest';
import type { ControlEvent } from '../../../core/types';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';
import { logic } from './index';

const gates = (ev: ControlEvent[]) => ev.map((e) => [+stepOf(e.t, 4).toFixed(3), (e as { on: boolean }).on]);

function run(op: number, a = 2, b = 4, gateA = 0.5, gateB = 0.5) {
  const sim = simulate(
    [
      TRANSPORT,
      { id: 'ca', module: 'clock', params: { division: a, gate: gateA } },
      { id: 'cb', module: 'clock', params: { division: b, gate: gateB } },
      { id: 'g', module: 'logicGate', params: { op } },
    ],
    [
      { from: 'tr.bar', to: 'ca.phase' },
      { from: 'tr.bar', to: 'cb.phase' },
      { from: 'ca.gate', to: 'g.a' },
      { from: 'cb.gate', to: 'g.b' },
    ],
    ['g.gate', 'g.trig'],
  );
  sim.runTo(1);
  return sim;
}

describe('logic', () => {
  it('tabelle di verità', () => {
    const t = (op: number) => [logic(op, false, false), logic(op, false, true), logic(op, true, false), logic(op, true, true)];
    expect(t(0)).toEqual([false, false, false, true]);
    expect(t(1)).toEqual([false, true, true, true]);
    expect(t(2)).toEqual([false, true, true, false]);
    expect(t(3)).toEqual([true, true, false, false]);
    expect(t(4)).toEqual([true, true, true, false]);
    expect(t(5)).toEqual([true, false, false, false]);
  });
});

describe('Porte logiche su due gate (A: metà battuta, B: quarti a metà)', () => {
  // A alto in [0,1) e [2,3) quarti; B alto in [0,0.5) [1,1.5) [2,2.5) [3,3.5)
  it('AND: alto solo dove si sovrappongono, agli istanti esatti', () => {
    expect(gates(run(0).events('g.gate'))).toEqual([
      [0, true],
      [0.5, false],
      [2, true],
      [2.5, false],
    ]);
  });

  it('OR e XOR', () => {
    expect(gates(run(1).events('g.gate'))).toEqual([
      [0, true],
      [1.5, false],
      [2, true],
      [3.5, false],
    ]);
    expect(gates(run(2).events('g.gate'))).toEqual([
      [0.5, true],
      [1.5, false],
      [2.5, true],
      [3.5, false],
    ]);
  });

  it('NOT inverte A e dà un trigger a ogni accensione', () => {
    const sim = run(3);
    expect(gates(sim.events('g.gate'))).toEqual([
      [0, false],
      [1, true],
      [2, false],
      [3, true],
    ]);
    expect(sim.events('g.trig').map((e) => stepOf(e.t, 4))).toEqual([1, 3]);
  });

  it('trigger contano come impulsi: OR di due clock di trigger', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'ca', module: 'clock', params: { division: 2 } },
        { id: 'cb', module: 'clock', params: { division: 4, offset: 0.5 } },
        { id: 'g', module: 'logicGate', params: { op: 1, pulse: 0.01 } },
      ],
      [
        { from: 'tr.bar', to: 'ca.phase' },
        { from: 'tr.bar', to: 'cb.phase' },
        { from: 'ca.trig', to: 'g.a' },
        { from: 'cb.trig', to: 'g.b' },
      ],
      ['g.trig'],
    );
    sim.runTo(1);
    expect(sim.events('g.trig').map((e) => stepOf(e.t, 8))).toEqual([0, 1, 3, 4, 5, 7]);
  });
});
