import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/core/engine';
import { addNode, connect } from '../../src/core/patchEdit';
import type { Patch } from '../../src/core/types';
import { moduleRegistry } from '../../src/modules/registry';
import { FrameGraph } from '../../src/visual/frameGraph';

const patch: Patch = {
  version: 1,
  seed: 1,
  nodes: [
    { id: 'tr', module: 'transport' },
    { id: 'noise', module: 'noiseField', params: { scale: 3 } },
    { id: 'screen', module: 'screen' },
  ],
  connections: [
    { from: 'tr.bar', to: 'noise.phase' },
    { from: 'noise.out', to: 'screen.in' },
  ],
};

describe('FrameGraph', () => {
  it('un cambio di parametro arriva subito al grafo dei visual, senza ricostruire', () => {
    const engine = new Engine(patch, moduleRegistry);
    const fg = new FrameGraph(engine, moduleRegistry);
    const g = fg.graph;
    engine.setParam('noise', 'scale', 7);
    expect(fg.graph).toBe(g);
    expect(fg.graph!.node('noise').ctx.param('scale')).toBeCloseTo(7, 6);
  });

  it('una modifica strutturale ricostruisce il grafo tenendo le istanze', () => {
    const engine = new Engine(patch, moduleRegistry);
    const fg = new FrameGraph(engine, moduleRegistry);
    const inst = fg.graph!.node('noise').instance;
    const added = addNode(engine.patch, moduleRegistry, 'feedback');
    engine.setPatch(connect(added.patch, moduleRegistry, { from: 'noise.out', to: `${added.id}.in` }));
    expect(fg.graph!.has(added.id)).toBe(true);
    expect(fg.graph!.node('noise').instance).toBe(inst);
  });
});
