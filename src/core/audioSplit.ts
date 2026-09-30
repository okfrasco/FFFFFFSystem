/**
 * Divide una patch tra main thread e AudioWorklet. Il sottografo audio
 * contiene i nodi a rate 'audio' e i cavi tra loro; ogni cavo che arriva da un
 * nodo di controllo diventa un nodo "ponte" che riceve i buffer dal main.
 */

import type { Registry } from './registry';
import type { Patch, PatchConnection, PatchNode } from './types';

export interface AudioSplit {
  /** Patch per il worklet: nodi audio + ponti. */
  patch: Patch;
  /** Uscite di controllo del main da mandare al worklet a ogni tick. */
  bridges: string[];
}

export const bridgeId = (source: string): string => `@${source.replace('.', '~')}`;

export function splitAudio(patch: Patch, registry: Registry): AudioSplit {
  const rate = (id: string) => {
    const pn = patch.nodes.find((n) => n.id === id);
    return pn ? registry.get(pn.module)?.manifest.rate : undefined;
  };
  const nodeOf = (ep: string) => ep.slice(0, ep.indexOf('.'));
  const nodes: PatchNode[] = patch.nodes.filter((n) => rate(n.id) === 'audio');
  const connections: PatchConnection[] = [];
  const bridges: string[] = [];
  for (const c of patch.connections) {
    const src = rate(nodeOf(c.from));
    const dst = rate(nodeOf(c.to));
    if (dst !== 'audio') continue;
    if (src === 'audio') {
      connections.push(c);
    } else if (src === 'control') {
      const id = bridgeId(c.from);
      if (!bridges.includes(c.from)) {
        bridges.push(c.from);
        nodes.push({ id, module: 'bridge', config: { key: c.from } });
      }
      connections.push({ ...c, from: `${id}.out` });
    }
  }
  return { patch: { version: 1, seed: patch.seed, nodes, connections }, bridges };
}
