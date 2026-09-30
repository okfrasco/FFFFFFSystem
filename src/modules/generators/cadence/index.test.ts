import { describe, expect, it } from 'vitest';
import { cadenceHits } from './index';
import { TRANSPORT, compact, simulate, stepOf } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>, bars = 2, seed = 1, extra: { nodes?: never[]; conns?: never[] } = {}) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'cadence', params }, ...(extra.nodes ?? [])],
    [{ from: 'tr.bar', to: 'c.phase' }, ...(extra.conns ?? [])],
    ['c.note', 'c.trig', 'c.pos'],
    seed,
  );
  sim.runTo(bars);
  return sim;
}

describe('cadenceHits', () => {
  it('size = multiple × bar length, un colpo ogni cadence, conteggio che riparte alla size', () => {
    expect(cadenceHits(3, 5, 4)).toEqual({ size: 15, hits: [0, 4, 8, 12] });
    expect(cadenceHits(1, 16, 3).hits).toEqual([0, 3, 6, 9, 12, 15]);
    expect(cadenceHits(2, 4, 3, 1).hits).toEqual([1, 4, 7]);
  });
});

describe('Cadenza', () => {
  it('cadence 3 su size 16: colpi a 0,3,…,15 e poi di nuovo da 16', () => {
    const ev = run({ multiple: 1, barLength: 16, cadence: 3 }).events('c.note');
    expect(ev.map((e) => stepOf(e.t))).toEqual([0, 3, 6, 9, 12, 15, 16, 19, 22, 25, 28, 31]);
  });

  it('size 15 contro la battuta da 16: il pattern scivola (polimetro)', () => {
    const ev = run({ multiple: 3, barLength: 5, cadence: 4 }, 2).events('c.note');
    // 0,4,8,12 | 15,19,23,27 | 30
    expect(ev.map((e) => stepOf(e.t))).toEqual([0, 4, 8, 12, 15, 19, 23, 27, 30]);
  });

  it('pitch, length (in step) e velocity dei parametri', () => {
    const ev = run({ cadence: 4, pitch: 67, length: 2, velocity: 0.5 }, 1).events('c.note') as { pitch: number; dur: number; vel: number }[];
    expect(ev[0]!.pitch).toBeCloseTo(67, 6);
    expect(ev[0]!.vel).toBeCloseTo(0.5, 6);
    // 2 sedicesimi a 120 BPM = 0.25 s
    expect(ev[0]!.dur).toBeCloseTo(0.25, 6);
  });

  it('modulato da un LFO aliasato il pitch cambia colpo per colpo', () => {
    const sim = run({ cadence: 1, pitch: 48 }, 2, 1, {
      nodes: [{ id: 'lfo', module: 'aliasLfo', params: { pattern: 25 } }] as never[],
      conns: [
        { from: 'tr.bar', to: 'lfo.phase' },
        { from: 'lfo.out', to: 'c.param:pitch', amount: 1 / 6 },
      ] as never[],
    });
    const pitches = (sim.events('c.note') as { pitch: number }[]).slice(0, 9).map((e) => Math.round(e.pitch));
    // LFO pattern 25: 0, .25, .5, .75, 1, .75, … · (72/6 = 12 semitoni)
    expect(pitches).toEqual([48, 51, 54, 57, 60, 57, 54, 51, 48]);
  });

  it('pos segue la posizione nella size', () => {
    const sim = run({ multiple: 1, barLength: 8, cadence: 1 }, 1);
    const pos = sim.values('c.pos').map((v) => v[0]!);
    expect(Math.max(...pos)).toBeCloseTo(7 / 8, 6);
  });

  it('mutazione riproducibile a seed fisso', () => {
    const a = compact(run({ cadence: 3, mutation: 0.4 }, 8, 5).events('c.note'));
    expect(a).toEqual(compact(run({ cadence: 3, mutation: 0.4 }, 8, 5).events('c.note')));
    expect(a).not.toEqual(compact(run({ cadence: 3 }, 8, 5).events('c.note')));
    expect(a.slice(0, 24)).toMatchSnapshot();
  });
});
