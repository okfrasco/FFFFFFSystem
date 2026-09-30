/**
 * Sottografo dei visual: i nodi a rate 'frame' e i cavi tra loro. Ogni cavo
 * che arriva da un nodo di controllo (fase o controllo) diventa una "sonda":
 * legge l'uscita dalla sua Timeline all'istante mostrato, non dal buffer del
 * grafo di controllo (che è avanti di un lookahead). Lo stesso per le uscite
 * di controllo dei nodi audio (analisi), che hanno tempi reali di misura.
 */

import type { Registry } from './registry';
import type { Patch, PatchConnection, PatchNode } from './types';

export interface FrameSplit {
  patch: Patch;
  /**
   * Uscite da leggere con una Timeline, con il loro tipo. `source` 'audio' =
   * misurata nel worklet (Timeline dell'host, tempi reali), 'control' = del main.
   */
  probes: { key: string; type: 'phase' | 'control'; source: 'control' | 'audio' }[];
}

export const probeId = (source: string): string => `%${source.replace('.', '~')}`;

export function splitFrame(patch: Patch, registry: Registry): FrameSplit {
  const def = (id: string) => {
    const pn = patch.nodes.find((n) => n.id === id);
    return pn ? registry.get(pn.module) : undefined;
  };
  const nodeOf = (ep: string) => ep.slice(0, ep.indexOf('.'));
  const nodes: PatchNode[] = patch.nodes.filter((n) => def(n.id)?.manifest.rate === 'frame');
  const connections: PatchConnection[] = [];
  const probes: FrameSplit['probes'] = [];
  for (const c of patch.connections) {
    const src = def(nodeOf(c.from));
    const dst = def(nodeOf(c.to));
    if (dst?.manifest.rate !== 'frame' || !src) continue;
    if (src.manifest.rate === 'frame') {
      connections.push(c);
      continue;
    }
    const source = src.manifest.rate;
    if (source !== 'control' && source !== 'audio') continue;
    const port = src.manifest.outputs.find((p) => p.id === c.from.slice(c.from.indexOf('.') + 1));
    if (port?.type !== 'phase' && port?.type !== 'control') continue;
    const id = probeId(c.from);
    if (!probes.some((p) => p.key === c.from)) {
      probes.push({ key: c.from, type: port.type, source });
      nodes.push({ id, module: port.type === 'phase' ? 'probePhase' : 'probeControl', config: { key: c.from } });
    }
    connections.push({ ...c, from: `${id}.out` });
  }
  return { patch: { version: 1, seed: patch.seed, nodes, connections }, probes };
}
