/**
 * Operazioni di modifica della patch: funzioni pure che restituiscono una
 * patch nuova (così l'annulla è una pila di patch). La validazione di una
 * connessione usa solo i manifest, senza istanziare moduli.
 */

import { parseEndpoint, signalCompatible } from './graph';
import type { Registry } from './registry';
import type { Patch, PatchConnection, PatchNode, PortSpec } from './types';

export function emptyPatch(seed = 1): Patch {
  return { version: 1, seed, nodes: [], connections: [] };
}

/** Primo id libero del tipo base1, base2, ... */
export function uniqueId(patch: Patch, base: string): string {
  const taken = new Set(patch.nodes.map((n) => n.id));
  for (let i = 1; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

export function addNode(
  patch: Patch,
  registry: Registry,
  module: string,
  ui?: { x: number; y: number },
): { patch: Patch; id: string } {
  if (!registry.has(module)) throw new Error(`modulo sconosciuto: ${module}`);
  const id = uniqueId(patch, module);
  const node: PatchNode = ui ? { id, module, ui } : { id, module };
  return { patch: { ...patch, nodes: [...patch.nodes, node] }, id };
}

export function removeNode(patch: Patch, id: string): Patch {
  const touches = (ep: string) => ep.slice(0, ep.indexOf('.')) === id;
  return {
    ...patch,
    nodes: patch.nodes.filter((n) => n.id !== id),
    connections: patch.connections.filter((c) => !touches(c.from) && !touches(c.to)),
  };
}

export function moveNode(patch: Patch, id: string, ui: { x: number; y: number }): Patch {
  return { ...patch, nodes: patch.nodes.map((n) => (n.id === id ? { ...n, ui } : n)) };
}

export function setParam(patch: Patch, id: string, param: string, value: number): Patch {
  return {
    ...patch,
    nodes: patch.nodes.map((n) => (n.id === id ? { ...n, params: { ...n.params, [param]: value } } : n)),
  };
}

export function setConfig(patch: Patch, id: string, config: unknown): Patch {
  return { ...patch, nodes: patch.nodes.map((n) => (n.id === id ? { ...n, config } : n)) };
}

function portOf(patch: Patch, registry: Registry, node: string, port: string, side: 'inputs' | 'outputs'): PortSpec | undefined {
  const pn = patch.nodes.find((n) => n.id === node);
  const def = pn && registry.get(pn.module);
  return def?.manifest[side].find((p) => p.id === port);
}

/** Motivo per cui la connessione non è valida, o null se si può fare. */
export function connectionError(patch: Patch, registry: Registry, conn: PatchConnection): string | null {
  const from = parseEndpoint(conn.from);
  const to = parseEndpoint(conn.to);
  if (!from || !('port' in from)) return 'sorgente non valida';
  if (!to) return 'destinazione non valida';
  const out = portOf(patch, registry, from.node, from.port, 'outputs');
  if (!out) return `${conn.from} non è un'uscita`;
  if (patch.connections.some((c) => c.from === conn.from && c.to === conn.to)) return 'connessione già presente';
  if ('param' in to) {
    const pn = patch.nodes.find((n) => n.id === to.node);
    const def = pn && registry.get(pn.module);
    if (!def?.manifest.params.some((p) => p.id === to.param)) return `${to.node} non ha il parametro ${to.param}`;
    if (out.type !== 'control') return 'solo un segnale di controllo modula un parametro';
    return null;
  }
  const inp = portOf(patch, registry, to.node, to.port, 'inputs');
  if (!inp) return `${conn.to} non è un ingresso`;
  if (inp.type !== out.type) return `tipo ${out.type} → ${inp.type}`;
  if (inp.type === 'control' && !signalCompatible(out.signal ?? 'value', inp.signal ?? 'value'))
    return `segnale ${out.signal ?? 'value'} → ${inp.signal ?? 'value'}`;
  if ((inp.type === 'phase' || inp.type === 'texture') && patch.connections.some((c) => c.to === conn.to))
    return `l'ingresso ${inp.type} accetta una sola connessione`;
  return null;
}

/** Aggiunge una connessione, o lancia un Error con il motivo. */
export function connect(patch: Patch, registry: Registry, conn: PatchConnection): Patch {
  const err = connectionError(patch, registry, conn);
  if (err) throw new Error(err);
  const c: PatchConnection = { from: conn.from, to: conn.to };
  if (conn.to.includes('.param:')) c.amount = conn.amount ?? 0.5;
  return { ...patch, connections: [...patch.connections, c] };
}

export function disconnect(patch: Patch, from: string, to: string): Patch {
  return { ...patch, connections: patch.connections.filter((c) => !(c.from === from && c.to === to)) };
}

export function setAmount(patch: Patch, from: string, to: string, amount: number): Patch {
  return {
    ...patch,
    connections: patch.connections.map((c) => (c.from === from && c.to === to ? { ...c, amount } : c)),
  };
}

/**
 * Adatta una patch a un catalogo di moduli (es. dopo aver modificato un
 * modulo): toglie i nodi di moduli che non esistono più, i parametri e le
 * porte sparite, e i cavi che le usavano. `removed` dice cosa è stato tolto.
 */
export function sanitizePatch(patch: Patch, registry: Registry): { patch: Patch; removed: string[] } {
  const removed: string[] = [];
  const nodes = patch.nodes.filter((n) => {
    const ok = registry.has(n.module);
    if (!ok) removed.push(`nodo ${n.id} (modulo ${n.module})`);
    return ok;
  }).map((n) => {
    if (!n.params) return n;
    const specs = registry.get(n.module)!.manifest.params;
    const params: Record<string, number> = {};
    for (const [k, v] of Object.entries(n.params)) {
      if (specs.some((p) => p.id === k)) params[k] = v;
      else removed.push(`parametro ${n.id}.${k}`);
    }
    return { ...n, params };
  });
  const clean = { ...patch, nodes };
  const connections = patch.connections.filter((c) => {
    const ok = connectionError({ ...clean, connections: [] }, registry, c) === null;
    if (!ok) removed.push(`cavo ${c.from} → ${c.to}`);
    return ok;
  });
  return { patch: { ...clean, connections }, removed };
}

/**
 * Posizioni per i nodi che non ne hanno: colonne per profondità nel grafo
 * (le sorgenti a sinistra), righe nell'ordine della patch.
 */
export function autoLayout(patch: Patch, registry: Registry): Patch {
  if (patch.nodes.every((n) => n.ui)) return patch;
  const deps = new Map<string, string[]>(patch.nodes.map((n) => [n.id, []]));
  for (const c of patch.connections) {
    const src = c.from.slice(0, c.from.indexOf('.'));
    const dst = c.to.slice(0, c.to.indexOf('.'));
    if (src !== dst) deps.get(dst)?.push(src);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // ciclo: si ferma qui
    visiting.add(id);
    const d = Math.max(-1, ...(deps.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  const colY = new Map<number, number>();
  const nodes = patch.nodes.map((n) => {
    if (n.ui) return n;
    const d = depthOf(n.id);
    const y = colY.get(d) ?? 40;
    const params = registry.get(n.module)?.manifest.params.length ?? 0;
    colY.set(d, y + 90 + Math.min(params, 8) * 24);
    return { ...n, ui: { x: 40 + d * 300, y } };
  });
  return { ...patch, nodes };
}
