import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>, bars = 2, seed = 1) {
  const sim = simulate([TRANSPORT, { id: 'a', module: 'acid', params }], [{ from: 'tr.bar', to: 'a.phase' }], ['a.note', 'a.accent'], seed);
  sim.runTo(bars);
  return sim;
}

const perBar = (ev: { t: number; pitch: number }[], bar: number) => ev.filter((e) => Math.floor(e.t / 2) === bar).map((e) => `${((e.t / 0.125) % 16).toFixed(3)}:${e.pitch}`);

describe('Acid', () => {
  it('senza mutazione il pattern si ripete identico ogni battuta', () => {
    const ev = run({ mutate: 0 }).events('a.note') as { t: number; pitch: number }[];
    expect(perBar(ev, 1)).toEqual(perBar(ev, 0));
    expect(ev.length).toBeGreaterThan(4);
  });

  it('slide più lunghi dello step, accenti a velocity piena con la loro uscita', () => {
    const sim = run({ slide: 1, accent: 1, mutate: 0 }, 1);
    const notes = sim.events('a.note') as { dur: number; vel: number }[];
    notes.forEach((n) => {
      expect(n.dur).toBeGreaterThan(0.125);
      expect(n.vel).toBe(1);
    });
    expect(sim.events('a.accent')).toHaveLength(notes.length);
  });

  it('con mutazione il pattern cambia piano, riproducibile a seed fisso', () => {
    const a = run({ mutate: 1 }, 8, 5).events('a.note') as { t: number; pitch: number }[];
    const b = run({ mutate: 1 }, 8, 5).events('a.note') as { t: number; pitch: number }[];
    expect(a.map((e) => e.pitch)).toEqual(b.map((e) => e.pitch));
    expect(perBar(a, 7)).not.toEqual(perBar(a, 0));
  });
});
