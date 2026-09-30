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

export interface ScopeFrame {
  key: string;
  /** Ultimo blocco, voci sommate. */
  samples: Float32Array;
  /** RMS del blocco, su tutte le voci. */
  rms: number;
}

/** "nodo.porta" delle uscite audio dei nodi audio (per gli oscilloscopi). */
export function scopeOutputs(graph: Graph): string[] {
  const keys: string[] = [];
  for (const n of graph.order) {
    if (n.def.manifest.rate !== 'audio') continue;
    for (const p of n.def.manifest.outputs) if (p.type === 'audio') keys.push(`${n.id}.${p.id}`);
  }
  return keys;
}

export function collectScopes(graph: Graph, keys: readonly string[]): ScopeFrame[] {
  const out: ScopeFrame[] = [];
  for (const key of keys) {
    const [node, port] = key.split('.') as [string, string];
    const buf = graph.output(node, port);
    if (buf.type !== 'audio' || buf.channels.length === 0) continue;
    const frames = buf.channels[0]!.length;
    const samples = new Float32Array(frames);
    let sq = 0;
    for (const ch of buf.channels) {
      for (let i = 0; i < frames; i++) {
        samples[i]! += ch[i]!;
        sq += ch[i]! * ch[i]!;
      }
    }
    out.push({ key, samples, rms: Math.sqrt(sq / (frames * buf.channels.length)) });
  }
  return out;
}
