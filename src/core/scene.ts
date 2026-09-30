/**
 * Scene: istantanee di parametri, seed e config di tutti i nodi, con lo stato
 * interno (memorie, catene, RNG) se richiesto. Una scena non tocca la
 * struttura: richiamarla cambia i valori dei nodi che esistono, ignora gli altri.
 */

import type { Engine } from './engine';
import type { RngState } from './rng';
import { cloneJson, type Patch, type Scene, type SceneNode } from './types';

export function captureScene(engine: Engine, name: string, withState = false): Scene {
  const nodes: Record<string, SceneNode> = {};
  for (const pn of engine.patch.nodes) {
    const g = engine.graph.node(pn.id);
    const sn: SceneNode = { params: g.params.snapshot(), seed: g.seed };
    const config = pn.config ?? g.def.defaultConfig;
    if (config !== undefined && config !== null) sn.config = cloneJson(config);
    if (withState && g.def.manifest.rate === 'control') {
      sn.state = cloneJson(g.instance.getState());
      sn.rng = [...g.ctx.rng.getState()] as [number, number, number, number];
    }
    nodes[pn.id] = sn;
  }
  return { name, nodes };
}

/** La patch con parametri, seed e config della scena (solo i nodi che esistono). */
export function sceneToPatch(patch: Patch, scene: Scene): Patch {
  return {
    ...patch,
    nodes: patch.nodes.map((n) => {
      const sn = scene.nodes[n.id];
      if (!sn) return n;
      const next = { ...n, params: { ...n.params, ...sn.params }, seed: sn.seed };
      if (sn.config !== undefined) next.config = cloneJson(sn.config);
      return next;
    }),
  };
}

/** Richiama una scena con un taglio netto; con `withState` anche memorie e RNG. */
export function recallScene(engine: Engine, scene: Scene, withState = false): void {
  engine.cancelMorph();
  engine.setPatch(sceneToPatch(engine.patch, scene));
  if (!withState) return;
  for (const [id, sn] of Object.entries(scene.nodes)) {
    if (!engine.graph.has(id) || sn.state === undefined) continue;
    const g = engine.graph.node(id);
    g.instance.setState(cloneJson(sn.state));
    if (sn.rng) g.ctx.rng.setState(sn.rng as unknown as RngState);
  }
}
