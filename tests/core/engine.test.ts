import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/core/engine';
import { GraphError } from '../../src/core/graph';
import { addNode, connect, removeNode, setConfig } from '../../src/core/patchEdit';
import type { ControlBuffer, Patch } from '../../src/core/types';
import { testRegistry } from '../helpers/sim';

const base: Patch = {
  version: 1,
  seed: 3,
  nodes: [
    { id: 'tr', module: 'transport' },
    { id: 's', module: 'steps', config: { values: [0, 1, 2, 3] } },
    { id: 'm', module: 'memory', params: { mutation: 0.5 } },
  ],
  connections: [
    { from: 'tr.bar', to: 's.phase' },
    { from: 'tr.bar', to: 'm.phase' },
    { from: 's.trig', to: 'm.in' },
  ],
};

function runTicks(e: Engine, from: number, n: number): number {
  for (let k = from; k < from + n; k++) e.process(k * 0.005, (k + 1) * 0.005);
  return from + n;
}

describe('Engine', () => {
  it('le modifiche strutturali tengono lo stato dei nodi rimasti', () => {
    const e = new Engine(base, testRegistry);
    let k = runTicks(e, 0, 800); // 2 battute
    e.setParam('m', 'hold', 1);
    k = runTicks(e, k, 1600); // la memoria sta derivando
    const memBefore = JSON.stringify(e.graph.node('m').instance.getState());
    const trBefore = e.graph.node('tr').instance.getState();
    const instance = e.graph.node('m').instance;
    // aggiunge un nodo e un cavo mentre suona
    const added = addNode(e.patch, testRegistry, 'euclid');
    e.setPatch(connect(added.patch, testRegistry, { from: 'tr.bar', to: `${added.id}.phase` }));
    expect(e.graph.node('m').instance).toBe(instance);
    expect(JSON.stringify(e.graph.node('m').instance.getState())).toBe(memBefore);
    expect(e.graph.node('tr').instance.getState()).toEqual(trBefore);
    expect(e.graph.tick).toBe(k);
    runTicks(e, k, 10);
  });

  it('una ricostruzione non cambia la sequenza casuale dei nodi rimasti', () => {
    const plain = new Engine(base, testRegistry);
    const edited = new Engine(base, testRegistry);
    for (const e of [plain, edited]) e.setParam('m', 'hold', 1);
    const out = (e: Engine) => (e.graph.output('m', 'out') as ControlBuffer).events.map((x) => x.t);
    const a: number[] = [];
    const b: number[] = [];
    for (let k = 0; k < 4000; k++) {
      if (k === 2000) edited.setPatch(addNode(edited.patch, testRegistry, 'gates').patch);
      plain.process(k * 0.005, (k + 1) * 0.005);
      edited.process(k * 0.005, (k + 1) * 0.005);
      a.push(...out(plain));
      b.push(...out(edited));
    }
    expect(b).toEqual(a);
  });

  it('una patch non valida non tocca il grafo in uso', () => {
    const e = new Engine(base, testRegistry);
    const g = e.graph;
    const bad: Patch = { ...base, connections: [...base.connections, { from: 's.value', to: 'tr.bar' }] };
    expect(() => e.setPatch(bad)).toThrow(GraphError);
    expect(e.graph).toBe(g);
    expect(e.patch).toBe(base);
  });

  it('cambiare la config aggiorna l\'istanza senza ricrearla', () => {
    const e = new Engine(base, testRegistry);
    const inst = e.graph.node('s').instance;
    e.setPatch(setConfig(e.patch, 's', { values: [7] }));
    expect(e.graph.node('s').instance).toBe(inst);
    runTicks(e, 0, 10);
    expect((e.graph.output('s', 'value') as ControlBuffer).values[0]).toBe(7);
  });

  it('un nodo tolto e rimesso con lo stesso id riparte da zero', () => {
    const e = new Engine(base, testRegistry);
    const inst = e.graph.node('m').instance;
    const without = removeNode(e.patch, 'm');
    e.setPatch(without);
    e.setPatch(base);
    expect(e.graph.node('m').instance).not.toBe(inst);
  });

  it('le timeline sopravvivono alle ricostruzioni', () => {
    const e = new Engine(base, testRegistry);
    const tl = e.tap('tr', 'bar');
    runTicks(e, 0, 100);
    e.setPatch(addNode(e.patch, testRegistry, 'gates').patch);
    runTicks(e, 100, 100);
    expect(tl.range()[1]).toBeCloseTo(1, 9);
    expect(tl.sample(1)).toBeCloseTo(0.5, 6);
  });

  it('setParam aggiorna anche la patch, con il valore effettivo', () => {
    const e = new Engine(base, testRegistry);
    e.setParam('m', 'length', 3.4);
    expect(e.patch.nodes.find((n) => n.id === 'm')!.params).toMatchObject({ length: 3, mutation: 0.5 });
  });
});

describe('Engine.setConfig', () => {
  it('cambia la config al volo senza ricostruire', () => {
    const e = new Engine(base, testRegistry);
    const g = e.graph;
    e.setConfig('s', { values: [5, 6] });
    expect(e.graph).toBe(g);
    expect(e.patch.nodes.find((n) => n.id === 's')!.config).toEqual({ values: [5, 6] });
    runTicks(e, 0, 10);
    expect((e.graph.output('s', 'value') as ControlBuffer).values[0]).toBe(5);
  });
});
