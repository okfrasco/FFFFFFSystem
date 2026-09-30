import { describe, expect, it } from 'vitest';
import { Graph } from '../../../src/core/graph';
import type { PhaseBuffer } from '../../../src/core/types';
import { moduleRegistry } from '../../../src/modules/registry';

const TICK = 0.005;

function makeTransport(params: Record<string, number> = {}, startTick = 0) {
  const g = Graph.build(
    { version: 1, seed: 1, nodes: [{ id: 'tr', module: 'transport', params }], connections: [] },
    moduleRegistry,
  );
  let k = startTick;
  const run = (seconds: number) => {
    const n = Math.round(seconds / TICK);
    for (let i = 0; i < n; i++, k++) g.process(k * TICK, (k + 1) * TICK);
  };
  const bar = () => g.output('tr', 'bar') as PhaseBuffer;
  const beat = () => g.output('tr', 'beat') as PhaseBuffer;
  return { g, run, bar, beat };
}

describe('Transport', () => {
  it('120 BPM in 4/4: 2 secondi = 1 battuta = 4 beat', () => {
    const { run, bar, beat } = makeTransport();
    run(2);
    expect(bar().end[0]).toBeCloseTo(1, 9);
    expect(beat().end[0]).toBeCloseTo(4, 9);
  });

  it('nessuna deriva su 1000 battute', () => {
    const { run, bar } = makeTransport({ bpm: 137 });
    const seconds = (1000 * 4 * 60) / 137;
    run(seconds);
    // il run arrotonda al tick: confronta con il tempo effettivamente simulato
    const simulated = Math.round(seconds / TICK) * TICK;
    expect(bar().end[0]).toBeCloseTo((simulated * 137) / 60 / 4, 6);
  });

  it('la fase è continua da un tick al successivo, anche cambiando BPM', () => {
    const { g, bar, beat } = makeTransport();
    let prevBar = 0;
    let prevBeat = 0;
    for (let k = 0; k < 2000; k++) {
      if (k === 700) g.setParam('tr', 'bpm', 174);
      if (k === 1400) g.setParam('tr', 'bpm', 61);
      g.process(k * TICK, (k + 1) * TICK);
      expect(bar().start[0]).toBe(prevBar);
      expect(beat().start[0]).toBe(prevBeat);
      prevBar = bar().end[0]!;
      prevBeat = beat().end[0]!;
    }
    const expectedBeats = (700 * TICK * 120 + 700 * TICK * 174 + 600 * TICK * 61) / 60;
    expect(beat().end[0]).toBeCloseTo(expectedBeats, 9);
  });

  it('il metro cambia solo all\'inizio della battuta successiva', () => {
    const { g, run, bar, beat } = makeTransport();
    run(3); // battuta 1.5, beat 6
    g.setParam('tr', 'meter', 3);
    run(1); // arriva a battuta 2 (beat 8) ancora in 4/4, poi in 3/4
    // beat 8 = battuta 2; beat 8 + 3 = battuta 3
    run(1.5); // totale 5.5 s = beat 11
    expect(beat().end[0]).toBeCloseTo(11, 9);
    expect(bar().end[0]).toBeCloseTo(3, 9);
  });

  it('lo stato salvato riprende esattamente', () => {
    const a = makeTransport();
    a.run(1.235);
    const saved = JSON.parse(JSON.stringify(a.g.node('tr').instance.getState()));
    // b riprende agli stessi tempi assoluti di a: stesso dt, bit per bit
    const b = makeTransport({}, Math.round(1.235 / TICK));
    b.g.node('tr').instance.setState(saved);
    a.run(1);
    b.run(1);
    expect(b.bar().end[0]).toBe(a.bar().end[0]);
  });
});
