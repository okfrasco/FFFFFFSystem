/**
 * Engine — tiene la patch in uso e il grafo che la suona.
 *
 * Le modifiche strutturali (nodi, cavi, config) ricostruiscono il grafo
 * riusando le istanze dei nodi rimasti, quindi si possono fare mentre suona.
 * I cambi di parametro vanno direttamente al grafo, senza ricostruire.
 * Le Timeline chieste con `tap` sopravvivono alle ricostruzioni.
 */

import { Graph } from './graph';
import { sanitizePatch } from './patchEdit';
import type { Morph } from './morph';
import type { Registry } from './registry';
import { Timeline } from './timeline';
import { cloneJson, type Patch } from './types';

export type EngineChange =
  | { kind: 'patch'; patch: Patch }
  | { kind: 'param'; node: string; param: string; value: number };

interface TapRequest {
  node: string;
  port: string;
  timeline: Timeline;
}

export class Engine {
  private current: Graph;
  private currentPatch: Patch;
  private readonly taps: TapRequest[] = [];
  /** Chiamati dopo ogni tick, per chi consuma le uscite (suono, interfaccia). */
  readonly listeners = new Set<(t0: number, t1: number, graph: Graph) => void>();
  /** Chiamati quando cambia la patch (struttura o config) o un parametro base. */
  readonly changes = new Set<(change: EngineChange) => void>();

  private currentRegistry: Registry;

  constructor(patch: Patch, registry: Registry) {
    this.currentRegistry = registry;
    this.current = Graph.build(patch, registry);
    this.currentPatch = patch;
  }

  /** Catalogo dei moduli in uso. */
  get registry(): Registry {
    return this.currentRegistry;
  }

  /**
   * Nuovo catalogo (es. un modulo modificato mentre suona): la patch viene
   * adattata e il grafo ricostruito; i nodi dei moduli cambiati ripartono con
   * lo stato della versione precedente. Restituisce cosa è stato tolto.
   */
  setRegistry(registry: Registry): string[] {
    const { patch, removed } = sanitizePatch(this.currentPatch, registry);
    this.currentRegistry = registry;
    this.setPatch(patch);
    return removed;
  }

  get graph(): Graph {
    return this.current;
  }

  get patch(): Patch {
    return this.currentPatch;
  }

  /** Sostituisce la patch. Se non è valida lancia GraphError e non cambia niente. */
  setPatch(patch: Patch): void {
    const next = Graph.build(patch, this.currentRegistry, { reuse: this.current });
    for (const tap of this.taps) {
      if (next.has(tap.node)) {
        try {
          next.attachTap(tap.node, tap.port, tap.timeline);
        } catch {
          // la porta non esiste più: la timeline resta ferma
        }
      }
    }
    this.current = next;
    this.currentPatch = patch;
    this.emit({ kind: 'patch', patch });
  }

  private emit(change: EngineChange): void {
    for (const l of this.changes) l(change);
  }

  /** Cambio di un parametro base: aggiorna patch e grafo senza ricostruire. */
  setParam(nodeId: string, paramId: string, value: number): void {
    this.current.setParam(nodeId, paramId, value);
    const actual = this.current.getParam(nodeId, paramId);
    this.currentPatch = {
      ...this.currentPatch,
      nodes: this.currentPatch.nodes.map((n) =>
        n.id === nodeId ? { ...n, params: { ...n.params, [paramId]: actual } } : n,
      ),
    };
    this.emit({ kind: 'param', node: nodeId, param: paramId, value: actual });
  }

  /**
   * Nuova config di un nodo. Se il modulo sa aggiornarsi da solo (setConfig)
   * la cambia al volo, senza ricostruire: va bene anche durante un trascinamento.
   */
  setConfig(nodeId: string, config: unknown): void {
    const patch: Patch = {
      ...this.currentPatch,
      nodes: this.currentPatch.nodes.map((n) => (n.id === nodeId ? { ...n, config } : n)),
    };
    const node = this.current.node(nodeId);
    if (node.instance.setConfig) {
      const copy = cloneJson(config);
      node.instance.setConfig(copy);
      node.ctx.config = copy;
      this.currentPatch = patch;
      this.emit({ kind: 'patch', patch });
    } else {
      this.setPatch(patch);
    }
  }

  tap(node: string, port: string, capacity = 256): Timeline {
    const existing = this.taps.find((t) => t.node === node && t.port === port);
    if (existing) return existing.timeline;
    const timeline = new Timeline(capacity);
    this.current.attachTap(node, port, timeline);
    this.taps.push({ node, port, timeline });
    return timeline;
  }

  /** Morph in corso (vedi core/morph.ts). */
  morph: Morph | null = null;

  /** Battuta corrente dal primo Transport (dal tick precedente); senza Transport, secondi / 2. */
  currentBar(t: number): number {
    const tr = this.currentPatch.nodes.find((n) => n.module === 'transport');
    if (!tr || !this.current.has(tr.id)) return t / 2;
    const buf = this.current.output(tr.id, 'bar');
    return buf.type === 'phase' ? (buf.end[0] ?? 0) : t / 2;
  }

  startMorph(morph: Morph): void {
    this.cancelMorph();
    this.morph = morph;
  }

  /** Interrompe il morph lasciando i valori dove sono (la patch resta com'era). */
  cancelMorph(): void {
    if (!this.morph) return;
    this.morph.clear();
    for (const n of this.current.order) if (n.shadow) this.current.setShadow(n.id, null);
    this.morph = null;
  }

  /** Fine del morph: la patch finale sostituisce quella in uso (le ombre diventano i nodi). */
  endMorph(patch: Patch): void {
    this.morph = null;
    this.setPatch(patch);
    for (const n of this.current.order) {
      if (n.shadow) this.current.setShadow(n.id, null);
      n.ctx.morph = null;
    }
  }

  /** Avvisa chi ascolta (audio, visual) di un parametro cambiato dal morph. */
  notifyParam(node: string, param: string, value: number): void {
    this.emit({ kind: 'param', node, param, value });
  }

  process(t0: number, t1: number): void {
    if (this.morph && !this.morph.tick(this.currentBar(t0))) this.morph = null;
    this.current.process(t0, t1);
    for (const l of this.listeners) l(t0, t1, this.current);
  }
}
