/**
 * Grafo dei nodi visual (rate 'frame'), tenuto in sincronia con l'Engine:
 * ricostruito a ogni cambio di patch (riusando i nodi e le loro texture),
 * aggiornato al volo a ogni cambio di parametro. Senza WebGL: il renderer gli
 * passa il contesto, i test no.
 */

import type { Engine } from '../core/engine';
import { splitFrame } from '../core/frameSplit';
import { Graph, GraphError } from '../core/graph';
import { createRegistry, type Registry } from '../core/registry';
import type { Timeline } from '../core/timeline';
import { visualModules } from '../modules/visualModules';
import { probeControl, probePhase, setProbeResolver } from '../modules/visual/probe';

const frameRegistry = createRegistry([...visualModules, probePhase, probeControl]);

export class FrameGraph {
  graph: Graph | null = null;
  private timelines = new Map<string, Timeline>();
  onError?: (message: string) => void;

  constructor(
    private readonly engine: Engine,
    private readonly mainRegistry: Registry,
    private readonly gl?: WebGL2RenderingContext,
    /** Timeline con tempi reali per le uscite misurate nell'audio (es. Envelope follower). */
    private readonly externalTimeline: (key: string) => Timeline | undefined = () => undefined,
  ) {
    setProbeResolver((key) => this.timelines.get(key) ?? this.externalTimeline(key));
    engine.changes.add((c) => {
      if (c.kind === 'patch') this.rebuild();
      else if (this.graph?.has(c.node)) this.graph.setParam(c.node, c.param, c.value);
    });
    this.rebuild();
  }

  rebuild(): void {
    const split = splitFrame(this.engine.patch, this.mainRegistry);
    this.timelines = new Map();
    for (const p of split.probes) {
      if (p.source === 'audio') continue; // Timeline dell'host (externalTimeline)
      const [node, port] = p.key.split('.') as [string, string];
      this.timelines.set(p.key, this.engine.tap(node, port, 512));
    }
    try {
      this.graph = Graph.build(split.patch, frameRegistry, {
        ...(this.graph ? { reuse: this.graph } : {}),
        rate: 'frame',
        ...(this.gl ? { gl: this.gl } : {}),
      });
    } catch (e) {
      this.onError?.(e instanceof GraphError ? e.errors.join(' · ') : (e as Error).message);
    }
  }
}
