import { describe, expect, it } from 'vitest';
import type { ScopeFrame } from '../src/core/audioAnalysis';
import { Engine } from '../src/core/engine';
import { moduleRegistry } from '../src/modules';
import { svfGain } from '../src/modules/audio/filter/view';
import type { LoggedEvent, ViewContext } from '../src/ui/live';
import { genericView } from '../src/ui/editor/genericView';
import type { ViewFactory } from '../src/ui/editor/viewKit';

/** Un contesto 2D che accetta qualunque chiamata. */
function fakeCanvas(): CanvasRenderingContext2D {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 10 }) : prop === 'getLineDash' ? () => [] : () => undefined),
    set: () => true,
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D;
}

function fakeContext(engine: Engine, nodeId: string): ViewContext {
  const events: LoggedEvent[] = [
    { t: 0.9, v: 60, vel: 1, voice: 0 },
    { t: 0.95, v: 64, vel: 0.5, voice: 1 },
  ];
  const scope: ScopeFrame = { key: 'x', samples: new Float32Array(128).map((_, i) => Math.sin(i / 10)), rms: 0.5 };
  const node = engine.graph.node(nodeId);
  const io = {
    events: () => events,
    value: () => 1.25,
    voices: () => [0.1, 0.4, 0.8],
    history: () => [0, 0.5, 1, 0.5],
    scope: () => scope,
    thumbnail: () => null,
  };
  return {
    nodeId,
    seed: node.seed,
    now: 1,
    param: (id) => node.params.value(id),
    normalized: (id) => node.params.normalized(id),
    state: <T,>() => node.instance.getState() as T,
    config: <T,>() => (engine.patch.nodes.find((n) => n.id === nodeId)?.config ?? node.def.defaultConfig) as T,
    ...io,
    input: io,
  };
}

const views = import.meta.glob<ViewFactory>('../src/modules/*/*/view.ts', { eager: true, import: 'default' });

describe('view dei nodi', () => {
  it('ogni modulo ha una view (dedicata o generica) che disegna senza errori', () => {
    const patch = {
      version: 1 as const,
      seed: 1,
      nodes: [...moduleRegistry.values()].map((d) => ({ id: d.manifest.id, module: d.manifest.id })),
      connections: [],
    };
    const engine = new Engine(patch, moduleRegistry);
    let dedicated = 0;
    for (const def of moduleRegistry.values()) {
      const id = def.manifest.id;
      const factory = Object.entries(views).find(([p]) => p.split('/').at(-2) === id)?.[1];
      if (factory) dedicated++;
      const drawing = factory?.(id) ?? genericView(def);
      expect(drawing, id).not.toBeNull();
      expect(() => drawing!.draw(fakeCanvas(), 200, drawing!.height ?? 48, fakeContext(engine, id)), id).not.toThrow();
    }
    expect(dedicated).toBeGreaterThanOrEqual(18);
  });
});

describe('risposta del filtro nella view', () => {
  it('passa-basso: 1 in banda, 1/k al cutoff, −12 dB/ottava sopra', () => {
    expect(svfGain(0, 0.01, 1)).toBeCloseTo(1, 3);
    expect(svfGain(0, 1, 0.5)).toBeCloseTo(2, 6);
    expect(svfGain(0, 20, 1.4)).toBeCloseTo(1 / 400, 3);
    expect(svfGain(2, 20, 1.4)).toBeCloseTo(1, 1);
    expect(svfGain(3, 1, 1)).toBe(0);
  });
});
