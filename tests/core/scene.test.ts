import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/core/engine';
import { Morph, shapeProgress } from '../../src/core/morph';
import { captureScene, recallScene, sceneToPatch } from '../../src/core/scene';
import type { ControlBuffer, ControlEvent, Patch } from '../../src/core/types';
import { testRegistry } from '../helpers/sim';

const TICK = 0.005;
const base: Patch = {
  version: 1,
  seed: 3,
  nodes: [
    { id: 'tr', module: 'transport', params: { bpm: 120 } },
    { id: 'eu', module: 'euclid', params: { steps: 16, pulses: 4, mutation: 0 } },
    { id: 's', module: 'steps', config: { values: [0, 1, 2, 3] } },
    { id: 'm', module: 'memory', params: { mutation: 0.4 } },
    { id: 'q', module: 'quantize', params: { length: 0.1 } },
  ],
  connections: [
    { from: 'tr.bar', to: 'eu.phase' },
    { from: 'tr.bar', to: 's.phase' },
    { from: 'tr.bar', to: 'm.phase' },
    { from: 's.trig', to: 'm.in' },
    { from: 'eu.trig', to: 'q.trig' },
  ],
};

function runner(e: Engine) {
  let k = 0;
  return (seconds: number, collect?: [string, string], into?: ControlEvent[]) => {
    const n = Math.round(seconds / TICK);
    for (let i = 0; i < n; i++, k++) {
      e.process(k * TICK, (k + 1) * TICK);
      if (collect && into) for (const ev of (e.graph.output(collect[0], collect[1]) as ControlBuffer).events) into.push({ ...ev });
    }
  };
}

describe('scene', () => {
  it('cattura e richiama parametri, config e seed', () => {
    const e = new Engine(base, testRegistry);
    const a = captureScene(e, 'A');
    e.setParam('eu', 'pulses', 7);
    e.setConfig('s', { values: [9] });
    const b = captureScene(e, 'B');
    expect(b.nodes.eu!.params.pulses).toBe(7);
    expect(b.nodes.s!.config).toEqual({ values: [9] });
    recallScene(e, a);
    expect(e.graph.getParam('eu', 'pulses')).toBe(4);
    expect(e.patch.nodes.find((n) => n.id === 's')!.config).toEqual({ values: [0, 1, 2, 3] });
    recallScene(e, b);
    expect(e.graph.getParam('eu', 'pulses')).toBe(7);
  });

  it('con lo stato richiama anche le memorie', () => {
    const e = new Engine(base, testRegistry);
    const run = runner(e);
    run(2);
    e.setParam('m', 'hold', 1);
    run(2);
    const snap = captureScene(e, 'X', true);
    const memBefore = JSON.stringify(e.graph.node('m').instance.getState());
    run(4); // la memoria deriva
    expect(JSON.stringify(e.graph.node('m').instance.getState())).not.toBe(memBefore);
    recallScene(e, snap, true);
    expect(JSON.stringify(e.graph.node('m').instance.getState())).toBe(memBefore);
  });

  it('sceneToPatch ignora i nodi che non ci sono più', () => {
    const e = new Engine(base, testRegistry);
    const sc = captureScene(e, 'A');
    sc.nodes.ghost = { params: {}, seed: 1 };
    expect(sceneToPatch(base, sc).nodes.map((n) => n.id)).toEqual(base.nodes.map((n) => n.id));
  });
});

describe('morph', () => {
  it('curve di progresso', () => {
    expect(shapeProgress(0.5, 'lin')).toBe(0.5);
    expect(shapeProgress(0.5, 'smooth')).toBe(0.5);
    expect(shapeProgress(0.5, 'in')).toBe(0.25);
    expect(shapeProgress(0.5, 'out')).toBe(0.75);
    expect(shapeProgress(2, 'lin')).toBe(1);
  });

  it('continuo: interpola nello spazio normalizzato (curva exp → media geometrica)', () => {
    const e = new Engine(base, testRegistry);
    const a = captureScene(e, 'A');
    e.setParam('q', 'length', 0.4);
    e.setParam('m', 'mutation', 0.8);
    const b = captureScene(e, 'B');
    recallScene(e, a);
    const m = new Morph(e, a, b);
    m.curve = 'lin';
    e.startMorph(m);
    m.set(0.5);
    expect(e.graph.getParam('q', 'length')).toBeCloseTo(Math.sqrt(0.1 * 0.4), 6);
    expect(e.graph.getParam('m', 'mutation')).toBeCloseTo(0.6, 6);
  });

  it('discreto per evento: a metà morph circa metà dei colpi segue B, in modo monotono', () => {
    const count = (p: number) => {
      const e = new Engine(base, testRegistry);
      const a = captureScene(e, 'A');
      e.setParam('q', 'root', 7); // tonica G invece di C: le note cambiano
      const b = captureScene(e, 'B');
      recallScene(e, a);
      const m = new Morph(e, a, b);
      m.curve = 'lin';
      e.startMorph(m);
      m.set(p);
      const notes: ControlEvent[] = [];
      runner(e)(200, ['q', 'note'], notes);
      // in modo grado, con valore assente la nota è base + tonica
      return notes.map((n) => (n as { pitch: number }).pitch === 55);
    };
    const half = count(0.5);
    const share = half.filter(Boolean).length / half.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
    const more = count(0.8);
    half.forEach((isB, i) => {
      if (isB) expect(more[i]).toBe(true); // ciò che è passato a B ci resta
    });
    expect(count(0).some(Boolean)).toBe(false);
    expect(count(1).every(Boolean)).toBe(true);
  });

  it('seed: un\'ombra con il seed di B, i colpi si mescolano, alla fine l\'ombra diventa il nodo', () => {
    const p: Patch = { ...base, nodes: base.nodes.map((n) => (n.id === 'eu' ? { ...n, params: { ...n.params, mutation: 0.6 }, seed: 11 } : n)) };
    const hitsOf = (seed: number) => {
      const e = new Engine({ ...p, nodes: p.nodes.map((n) => (n.id === 'eu' ? { ...n, seed } : n)) }, testRegistry);
      const ev: ControlEvent[] = [];
      runner(e)(20, ['eu', 'trig'], ev);
      return new Set(ev.map((x) => x.t.toFixed(6)));
    };
    const onlyA = hitsOf(11);
    const onlyB = hitsOf(22);
    const e = new Engine(p, testRegistry);
    const a = captureScene(e, 'A');
    const b = { ...a, name: 'B', nodes: { ...a.nodes, eu: { ...a.nodes.eu!, seed: 22 } } };
    const m = new Morph(e, a, b);
    m.curve = 'lin';
    e.startMorph(m);
    expect(e.graph.node('eu').shadow?.seed).toBe(22);
    m.set(0.5);
    const ev: ControlEvent[] = [];
    runner(e)(20, ['eu', 'trig'], ev);
    const mixed = ev.map((x) => x.t.toFixed(6));
    const fromA = mixed.filter((t) => onlyA.has(t) && !onlyB.has(t)).length;
    const fromB = mixed.filter((t) => onlyB.has(t) && !onlyA.has(t)).length;
    expect(fromA).toBeGreaterThan(0);
    expect(fromB).toBeGreaterThan(0);
    expect(mixed.every((t) => onlyA.has(t) || onlyB.has(t))).toBe(true);
    const shadow = e.graph.node('eu').shadow!.instance;
    m.finish('b');
    expect(e.graph.node('eu').seed).toBe(22);
    expect(e.graph.node('eu').instance).toBe(shadow);
    expect(e.graph.node('eu').shadow).toBeUndefined();
    expect(e.morph).toBeNull();
  });

  it('a tempo: arriva a B in N battute del Transport, poi la patch è B', () => {
    const e = new Engine(base, testRegistry);
    const run = runner(e);
    run(0.1);
    const a = captureScene(e, 'A');
    e.setParam('m', 'mutation', 1);
    e.setParam('eu', 'pulses', 8);
    const b = captureScene(e, 'B');
    recallScene(e, a);
    const m = new Morph(e, a, b);
    m.curve = 'lin';
    let finished = '';
    m.onFinish = (side) => (finished = side);
    e.startMorph(m);
    m.play(e.currentBar(0.1), 2);
    run(2); // una battuta: a metà
    expect(e.graph.getParam('m', 'mutation')).toBeCloseTo(0.7, 1);
    expect(finished).toBe('');
    run(2.1);
    expect(finished).toBe('b');
    expect(e.morph).toBeNull();
    expect(e.patch.nodes.find((n) => n.id === 'eu')!.params!.pulses).toBe(8);
    expect(e.graph.node('eu').ctx.morph).toBeNull();
  });

  it('config: ogni nodo passa a B alla sua soglia', () => {
    const e = new Engine(base, testRegistry);
    const a = captureScene(e, 'A');
    e.setConfig('s', { values: [7, 7] });
    const b = captureScene(e, 'B');
    recallScene(e, a);
    const m = new Morph(e, a, b);
    e.startMorph(m);
    m.set(0);
    expect(e.patch.nodes.find((n) => n.id === 's')!.config).toEqual({ values: [0, 1, 2, 3] });
    m.set(1);
    expect(e.patch.nodes.find((n) => n.id === 's')!.config).toEqual({ values: [7, 7] });
  });

  it('i parametri dei nodi audio arrivano a chi ascolta (worklet), a intervalli', () => {
    const p: Patch = { ...base, nodes: [...base.nodes, { id: 'f', module: 'filter', params: { cutoff: 200 } }] };
    const e = new Engine(p, testRegistry);
    const a = captureScene(e, 'A');
    e.setParam('f', 'cutoff', 5000);
    const b = captureScene(e, 'B');
    recallScene(e, a);
    const sent: number[] = [];
    e.changes.add((c) => {
      if (c.kind === 'param' && c.node === 'f') sent.push(c.value);
    });
    const m = new Morph(e, a, b);
    e.startMorph(m);
    m.play(e.currentBar(0), 1);
    runner(e)(2.1);
    expect(sent.length).toBeGreaterThan(10);
    expect(sent.length).toBeLessThan(150); // non a ogni tick (400)
    expect(sent.at(-1)).toBeCloseTo(5000, 0);
  });
});
