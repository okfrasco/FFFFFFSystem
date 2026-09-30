import { describe, expect, it } from 'vitest';
import type { ControlEvent } from '../../../core/types';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>, bars = 1, extra: { nodes?: never[]; conns?: never[]; from?: string } = {}) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params }, ...(extra.nodes ?? [])],
    [{ from: extra.from ?? 'tr.bar', to: 'c.phase' }, ...(extra.conns ?? [])],
    ['c.trig', 'c.gate', 'c.step'],
  );
  sim.runTo(bars);
  return sim;
}

const ons = (ev: ControlEvent[]) => ev.filter((e) => e.kind === 'gate' && e.on);
const offs = (ev: ControlEvent[]) => ev.filter((e) => e.kind === 'gate' && !e.on);

describe('Clock', () => {
  it('division 4 sulla battuta: un trigger per quarto, esattamente sul tempo', () => {
    const trig = run({ division: 4 }, 2).events('c.trig');
    expect(trig.map((e) => stepOf(e.t, 4))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(trig.map((e) => (e as { value: number }).value)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('12 divisioni = ottavi in terzina', () => {
    expect(run({ division: 12 }).events('c.trig')).toHaveLength(12);
  });

  it('il gate si chiude dopo `gate` step, anche in un tick successivo', () => {
    const sim = run({ division: 4, gate: 0.25 });
    const on = ons(sim.events('c.gate'));
    const off = offs(sim.events('c.gate'));
    expect(on).toHaveLength(4);
    expect(off).toHaveLength(4);
    // un quarto a 120 BPM = 0.5 s; gate 0.25 step = 0.125 s
    off.forEach((e, i) => expect(e.t - on[i]!.t).toBeCloseTo(0.125, 9));
  });

  it('gate 1: la chiusura coincide con l\'apertura successiva, e viene prima', () => {
    const ev = run({ division: 4, gate: 1 }).events('c.gate');
    const at1 = ev.filter((e) => Math.abs(e.t - 0.5) < 1e-9);
    expect(at1.map((e) => (e as { on: boolean }).on)).toEqual([false, true]);
  });

  it('swing e offset spostano gli step', () => {
    const sw = run({ division: 4, swing: 2 / 3 }).events('c.trig');
    expect(sw.map((e) => +stepOf(e.t, 4).toFixed(4))).toEqual([0, 1.3333, 2, 3.3333]);
    const late = run({ division: 4, offset: 0.25 }).events('c.trig');
    expect(late.map((e) => stepOf(e.t, 4))).toEqual([0.25, 1.25, 2.25, 3.25]);
    const early = run({ division: 4, offset: -0.25 }, 1).events('c.trig');
    expect(early.map((e) => stepOf(e.t, 4))).toEqual([0.75, 1.75, 2.75, 3.75]);
  });

  it('accento: il primo step del ciclo è pieno, gli altri più piano', () => {
    const trig = run({ division: 4, accent: 0.6 }).events('c.trig');
    expect(trig.map((e) => +(e as { vel: number }).vel.toFixed(3))).toEqual([1, 0.4, 0.4, 0.4]);
  });

  it('segue una fase piegata: con Ø Scale 3/2 i quarti diventano sei per battuta', () => {
    const sim = run({ division: 4 }, 1, {
      nodes: [{ id: 'sc', module: 'phaseScale', params: { num: 3, den: 2 } }] as never[],
      conns: [{ from: 'tr.bar', to: 'sc.in' }] as never[],
      from: 'sc.out',
    });
    expect(sim.events('c.trig')).toHaveLength(6);
  });

  it('su una fase poly ogni voce ha il suo clock', () => {
    const sim = run({ division: 2 }, 1, {
      nodes: [{ id: 'sp', module: 'phaseSplit', params: { count: 2, spread: 0.5 } }] as never[],
      conns: [{ from: 'tr.bar', to: 'sp.in' }] as never[],
      from: 'sp.out',
    });
    const byVoice = [0, 1].map((v) => sim.events('c.trig').filter((e) => e.voice === v).map((e) => stepOf(e.t, 4)));
    expect(byVoice).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it('step segue la posizione nel ciclo', () => {
    const steps = run({ division: 4 }).values('c.step').map((x) => x[0]!);
    expect(Math.max(...steps)).toBeCloseTo(0.75, 9);
  });
});
