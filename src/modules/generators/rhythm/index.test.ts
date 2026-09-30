import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate, stepOf } from '../../../../tests/helpers/sim';
import { GENRES, INSTRUMENTS, decide, stepProb } from './genres';

describe('libreria dei generi', () => {
  it('ogni genere ha 16 step per strumento e per linea, probabilità tra 0 e 1', () => {
    for (const g of GENRES) {
      for (const inst of INSTRUMENTS) {
        expect(g.drums[inst], `${g.name} ${inst}`).toHaveLength(16);
        for (const p of g.drums[inst]) expect(p >= 0 && p <= 1).toBe(true);
      }
      expect(g.bass).toHaveLength(16);
      expect(g.lead).toHaveLength(16);
    }
  });

  it('densità e decisione', () => {
    expect(stepProb(0.4, 0.5)).toBe(0.4);
    expect(stepProb(0.4, 0)).toBe(0);
    expect(stepProb(0.4, 1)).toBeGreaterThan(0.4);
    expect(decide(0.6, 0, 0.99, 0.5)).toBe(true); // canonico: p ≥ 0.5
    expect(decide(0.6, 1, 0.99, 0.5)).toBe(false); // pescato: u ≥ p
  });
});

function run(params: Record<string, number>, bars = 2, seed = 1) {
  const sim = simulate([TRANSPORT, { id: 'r', module: 'rhythm', params }], [{ from: 'tr.bar', to: 'r.phase' }], ['r.kick', 'r.snare', 'r.hat', 'r.perc'], seed);
  sim.runTo(bars);
  return sim;
}

describe('Rhythm', () => {
  it('four on the floor senza variazione: cassa sui quarti, rullante sul 2 e sul 4', () => {
    const sim = run({ genre: 0, variation: 0 });
    expect(sim.events('r.kick').map((e) => stepOf(e.t))).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(sim.events('r.snare').map((e) => stepOf(e.t))).toEqual([4, 12, 20, 28]);
  });

  it('half-time: il rullante solo a metà battuta', () => {
    expect(run({ genre: 4, variation: 0 }).events('r.snare').map((e) => stepOf(e.t))).toEqual([8, 24]);
  });

  it('variazione alta: le battute cambiano, in modo riproducibile', () => {
    const a = compact(run({ genre: 6, variation: 1 }, 4, 3).events('r.hat'));
    expect(a).toEqual(compact(run({ genre: 6, variation: 1 }, 4, 3).events('r.hat')));
    const bars = [0, 1, 2, 3].map((b) => a.filter((x) => Math.floor(parseFloat(x) / 16) === b).map((x) => (parseFloat(x) % 16).toFixed(3)).join());
    expect(new Set(bars).size).toBeGreaterThan(1);
  });

  it('densità 0 tace', () => {
    const sim = run({ density: 0, variation: 0 });
    expect(INSTRUMENTS.every((i) => sim.events(`r.${i}`).length === 0)).toBe(true);
  });
});
