/**
 * Uscite di controllo prodotte nell'audio (es. Envelope follower) che devono
 * tornare al main: dopo ogni blocco il worklet ne raccoglie i valori con il
 * tempo di fine blocco e li spedisce a gruppi.
 */

import type { Graph } from './graph';

export interface AnalysisPoint {
  key: string;
  t: number;
  v: number;
}

/** "nodo.porta" delle uscite di controllo dei nodi audio (i ponti esclusi). */
export function analysisOutputs(graph: Graph): string[] {
  const keys: string[] = [];
  for (const n of graph.order) {
    if (n.def.manifest.rate !== 'audio' || n.def.manifest.id === 'bridge') continue;
    for (const p of n.def.manifest.outputs) if (p.type === 'control') keys.push(`${n.id}.${p.id}`);
  }
  return keys;
}

export function collectAnalysis(graph: Graph, keys: readonly string[], t: number, into: AnalysisPoint[]): void {
  for (const key of keys) {
    const [node, port] = key.split('.') as [string, string];
    const buf = graph.output(node, port);
    if (buf.type === 'control') into.push({ key, t, v: buf.values[0] ?? 0 });
  }
}
