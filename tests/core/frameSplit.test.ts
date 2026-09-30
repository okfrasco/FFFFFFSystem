import { describe, expect, it } from 'vitest';
import { probeId, splitFrame } from '../../src/core/frameSplit';
import { Graph } from '../../src/core/graph';
import { Timeline } from '../../src/core/timeline';
import type { ControlBuffer, Patch, PhaseBuffer } from '../../src/core/types';
import { setProbeResolver } from '../../src/modules/_internal/probe';
import { frameRegistry, moduleRegistry } from '../../src/modules';

const patch: Patch = {
  version: 1,
  seed: 1,
  nodes: [
    { id: 'tr', module: 'transport' },
    { id: 'eu', module: 'euclid' },
    { id: 'noise', module: 'noiseField' },
    { id: 'col', module: 'color' },
    { id: 'screen', module: 'screen' },
    { id: 'osc', module: 'oscillator' },
  ],
  connections: [
    { from: 'tr.bar', to: 'eu.phase' },
    { from: 'tr.bar', to: 'noise.phase' },
    { from: 'eu.gate', to: 'col.param:brightness', amount: 0.3 },
    { from: 'noise.out', to: 'col.in' },
    { from: 'col.out', to: 'screen.in' },
  ],
};

describe('splitFrame', () => {
  it('tiene i nodi visual, trasforma fase e controllo in sonde, ignora audio e controllo puro', () => {
    const s = splitFrame(patch, moduleRegistry);
    expect(s.patch.nodes.map((n) => n.id).sort()).toEqual(['col', 'noise', probeId('eu.gate'), probeId('tr.bar'), 'screen'].sort());
    expect(s.probes).toEqual([
      { key: 'tr.bar', type: 'phase', source: 'control' },
      { key: 'eu.gate', type: 'control', source: 'control' },
    ]);
    expect(s.patch.connections).toContainEqual({ from: `${probeId('eu.gate')}.out`, to: 'col.param:brightness', amount: 0.3 });
    expect(s.patch.connections).toContainEqual({ from: 'noise.out', to: 'col.in' });
  });

  it('il sottografo si costruisce e le sonde leggono la Timeline all\'istante del frame', () => {
    const s = splitFrame(patch, moduleRegistry);
    const reg = frameRegistry;
    const g = Graph.build(s.patch, reg, { rate: 'frame' });
    const bar = new Timeline(8);
    bar.push(0, [0]);
    bar.push(2, [1]);
    const gate = new Timeline(8);
    gate.push(0, [0]);
    gate.push(1, [1]);
    setProbeResolver((k) => (k === 'tr.bar' ? bar : k === 'eu.gate' ? gate : undefined));
    g.process(0.5, 1); // senza contesto WebGL i nodi visual non disegnano, le sonde sì
    const ph = g.output(probeId('tr.bar'), 'out') as PhaseBuffer;
    expect([ph.start[0], ph.end[0]]).toEqual([0.25, 0.5]);
    expect((g.output(probeId('eu.gate'), 'out') as ControlBuffer).values[0]).toBe(1);
    // la modulazione arriva al parametro del nodo visual
    expect(g.node('col').ctx.param('brightness')).toBeCloseTo(0.3 * 2, 6);
  });
});

describe('splitFrame con analisi audio', () => {
  it('un\'uscita di controllo di un nodo audio diventa una sonda con sorgente audio', () => {
    const p: Patch = {
      version: 1,
      seed: 1,
      nodes: [
        { id: 'osc', module: 'oscillator' },
        { id: 'env', module: 'envFollower' },
        { id: 'col', module: 'color' },
      ],
      connections: [
        { from: 'osc.out', to: 'env.in' },
        { from: 'env.out', to: 'col.param:brightness' },
      ],
    };
    const s = splitFrame(p, moduleRegistry);
    expect(s.probes).toEqual([{ key: 'env.out', type: 'control', source: 'audio' }]);
    expect(s.patch.nodes.map((n) => n.id).sort()).toEqual([probeId('env.out'), 'col'].sort());
  });
});
