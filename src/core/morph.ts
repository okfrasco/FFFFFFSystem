/**
 * Morph A→B tra due scene. Il progresso p (0–1) passa per una curva; ogni
 * tipo di parametro si morpha nel suo modo:
 *
 *   continuo      interpolato nello spazio normalizzato (rispetta le curve exp)
 *   discreto      nodi di controllo: per evento, con soglia fissa (vedi
 *                 NodeContext.discrete); nodi audio e visual: ogni parametro
 *                 cambia alla sua soglia fissa
 *   config        ogni nodo cambia config alla sua soglia fissa
 *   seed          se il seed di un nodo di controllo cambia, un'istanza ombra
 *                 con il seed di B gira in parallelo e le uscite si mescolano
 *
 * Le soglie fisse rendono il morph monotono (ciò che è passato a B ci resta
 * mentre p cresce) e riproducibile. A fine morph la patch diventa B.
 *
 * Il progresso è a mano (slider) o a tempo: da p0 a p1 in N battute del
 * Transport, quindi segue il tempo musicale.
 */

import type { Engine } from './engine';
import { normalize } from './params';
import { hash01, hashString } from './rng';
import { sceneToPatch } from './scene';
import type { Scene } from './types';

export type MorphCurve = 'lin' | 'smooth' | 'in' | 'out';
export const MORPH_CURVES: readonly MorphCurve[] = ['lin', 'smooth', 'in', 'out'];

export function shapeProgress(p: number, curve: MorphCurve): number {
  const x = Math.max(0, Math.min(1, p));
  switch (curve) {
    case 'smooth':
      return x * x * (3 - 2 * x);
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    default:
      return x;
  }
}

interface Timed {
  startBar: number;
  bars: number;
  p0: number;
  p1: number;
}

/** Ogni quanti tick si mandano ad audio e visual i parametri che cambiano. */
const EMIT_EVERY = 4;

export class Morph {
  /** Progresso grezzo (prima della curva). */
  progress = 0;
  curve: MorphCurve = 'smooth';
  private timed: Timed | null = null;
  private ticks = 0;
  private readonly sent = new Map<string, number>();
  private readonly configSide = new Map<string, 'a' | 'b'>();
  /** Valori all'avvio, per i parametri che mancano in una delle due scene. */
  private readonly base = new Map<string, Record<string, number>>();
  /** Chiamato quando il morph finisce (la patch è diventata A o B). */
  onFinish?: (side: 'a' | 'b') => void;

  private graph: Engine['graph'] | null = null;

  constructor(
    private readonly engine: Engine,
    readonly from: Scene,
    readonly to: Scene,
  ) {
    this.setup();
  }

  /** Aggancia il morph al grafo in uso (anche dopo una ricostruzione per una modifica). */
  private setup(): void {
    const graph = this.engine.graph;
    this.graph = graph;
    const { from, to } = this;
    for (const id of Object.keys(to.nodes)) {
      const a = from.nodes[id];
      const b = to.nodes[id];
      if (!a || !b || !graph.has(id)) continue;
      const node = graph.node(id);
      // morph per evento dei discreti dei nodi di controllo
      if (node.def.manifest.rate === 'control') {
        const m = new Map<string, { a: number; b: number; hash: number }>();
        for (const spec of node.def.manifest.params) {
          if (spec.kind !== 'discrete') continue;
          // un parametro che manca in una scena resta al valore attuale
          const va = a.params[spec.id] ?? node.params.getBase(spec.id);
          const vb = b.params[spec.id] ?? node.params.getBase(spec.id);
          if (va !== vb) m.set(spec.id, { a: va, b: vb, hash: hashString(spec.id) });
        }
        node.ctx.morph = m.size ? m : null;
        node.ctx.morphSeed = node.seed;
        if (node.def.manifest.seeded && a.seed !== b.seed) graph.setShadow(id, b.seed);
      }
      if (!this.configSide.has(id)) this.configSide.set(id, 'a');
    }
  }

  get running(): boolean {
    return this.timed !== null;
  }

  /** Progresso a mano (slider). */
  set(p: number): void {
    this.timed = null;
    this.progress = Math.max(0, Math.min(1, p));
    this.apply(true);
  }

  /** Da `p0` a `p1` in `bars` battute, a partire dalla battuta corrente. */
  play(bar: number, bars: number, p1 = 1, p0 = this.progress): void {
    this.timed = { startBar: bar, bars: Math.max(1e-6, bars), p0, p1 };
  }

  /** Chiamato dall'Engine prima di ogni tick. false = morph finito. */
  tick(bar: number): boolean {
    if (this.timed) {
      const { startBar, bars, p0, p1 } = this.timed;
      const k = Math.max(0, Math.min(1, (bar - startBar) / bars));
      this.progress = p0 + (p1 - p0) * k;
      if (k >= 1) {
        this.finish(p1 >= 0.5 ? 'b' : 'a');
        return false;
      }
    }
    this.apply(++this.ticks % EMIT_EVERY === 0);
    return true;
  }

  private apply(emit: boolean): void {
    if (this.engine.graph !== this.graph) this.setup();
    const p = shapeProgress(this.progress, this.curve);
    const graph = this.engine.graph;
    for (const id of Object.keys(this.to.nodes)) {
      const a = this.from.nodes[id];
      const b = this.to.nodes[id];
      if (!a || !b || !graph.has(id)) continue;
      const node = graph.node(id);
      const isControl = node.def.manifest.rate === 'control';
      const base = this.base.get(id) ?? this.base.set(id, node.params.snapshot()).get(id)!;
      for (const spec of node.def.manifest.params) {
        const va = a.params[spec.id] ?? base[spec.id] ?? spec.default;
        const vb = b.params[spec.id] ?? base[spec.id] ?? spec.default;
        if (va === vb) continue;
        if (spec.kind === 'continuous') {
          const na = normalize(spec, va);
          node.params.setBaseNormalized(spec.id, na + (normalize(spec, vb) - na) * p);
        } else if (isControl) {
          continue; // per evento, nel contesto del nodo
        } else {
          node.params.setBase(spec.id, hash01(node.seed, hashString(spec.id)) < p ? vb : va);
        }
        if (!isControl && emit) {
          const value = node.params.getBase(spec.id);
          const key = `${id}.${spec.id}`;
          if (this.sent.get(key) !== value) {
            this.sent.set(key, value);
            this.engine.notifyParam(id, spec.id, value);
          }
        }
      }
      if (isControl) {
        node.ctx.morphP = p;
        if (node.shadow) node.shadow.p = p;
      }
      // config: ogni nodo passa alla sua soglia
      if (JSON.stringify(a.config) !== JSON.stringify(b.config)) {
        const side = hash01(node.seed, hashString('config')) < p ? 'b' : 'a';
        if (this.configSide.get(id) !== side) {
          this.configSide.set(id, side);
          const cfg = side === 'b' ? b.config : a.config;
          if (cfg !== undefined) this.engine.setConfig(id, cfg);
        }
      }
    }
  }

  /** Chiude il morph: la patch diventa A o B (seed compresi), le ombre spariscono. */
  finish(side: 'a' | 'b'): void {
    const scene = side === 'b' ? this.to : this.from;
    this.clear();
    this.engine.endMorph(sceneToPatch(this.engine.patch, scene));
    this.onFinish?.(side);
  }

  /** Toglie le tracce del morph dal grafo (discreti per evento, ombre). */
  clear(): void {
    const graph = this.engine.graph;
    for (const id of Object.keys(this.to.nodes)) {
      if (!graph.has(id)) continue;
      const node = graph.node(id);
      node.ctx.morph = null;
      node.ctx.morphP = 0;
    }
  }
}
