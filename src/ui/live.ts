/**
 * Monitor dal vivo per le view dei nodi: storia recente degli eventi e dei
 * valori delle uscite di controllo, oscilloscopi dell'audio (dal worklet),
 * miniature dei visual (dal renderer), stato interno dei nodi. Tutto letto
 * all'istante che si sta sentendo, non a quello calcolato in anticipo.
 */

import type { ScopeFrame } from '../core/audioAnalysis';
import type { Engine } from '../core/engine';
import type { Timeline } from '../core/timeline';
import { cloneJson } from '../core/types';
import type { Host } from './host';

export interface LoggedEvent {
  t: number;
  /** Valore portato (nota per le note, value per i trigger, 1 per i gate). */
  v: number;
  vel: number;
  voice: number;
}

const LOG_SIZE = 128;

/** Ciò che una view può leggere del suo nodo. */
export interface ViewContext {
  readonly nodeId: string;
  /** Seed del nodo (per le view che ricalcolano valori casuali, es. S&H Random). */
  readonly seed: number;
  /** Istante mostrato (clock audio meno la latenza d'uscita). */
  readonly now: number;
  /** Parametro effettivo (con modulazioni e morph) e normalizzato. */
  param(id: string): number;
  normalized(id: string): number;
  /** Stato interno del nodo (letto al massimo 10 volte al secondo). */
  state<T>(): T | null;
  config<T>(): T;
  /** Eventi di un'uscita negli ultimi `seconds`. */
  events(port: string, seconds: number): LoggedEvent[];
  /** Valore di un'uscita all'istante mostrato, e la sua storia (n punti in `seconds`). */
  value(port: string): number;
  /** Valore di ogni voce di un'uscita poly all'istante mostrato. */
  voices(port: string): number[];
  history(port: string, seconds: number, n: number): number[];
  /** Ultimo blocco audio di un'uscita (voci sommate) e il suo RMS. */
  scope(port: string): ScopeFrame | null;
  thumbnail(port: string): ImageData | null;
  /** Come sopra, ma per ciò che arriva a un ingresso (dalla sua sorgente). */
  input: {
    events(port: string, seconds: number): LoggedEvent[];
    value(port: string): number;
    history(port: string, seconds: number, n: number): number[];
    scope(port: string): ScopeFrame | null;
    thumbnail(port: string): ImageData | null;
  };
}

export class LiveMonitor {
  private readonly logs = new Map<string, LoggedEvent[]>();
  private readonly states = new Map<string, { at: number; state: unknown }>();

  constructor(
    private readonly engine: Engine,
    private readonly host: Host,
    private readonly thumbs: () => ReadonlyMap<string, ImageData>,
  ) {
    engine.listeners.add((_t0, _t1, graph) => {
      for (const node of graph.order) {
        if (node.def.manifest.rate !== 'control') continue;
        for (const [port, buf] of node.outputs.buffers) {
          if (buf.type !== 'control' || buf.events.length === 0) continue;
          const key = `${node.id}.${port}`;
          let log = this.logs.get(key);
          if (!log) this.logs.set(key, (log = []));
          for (const e of buf.events) {
            if (e.kind === 'gate' && !e.on) continue;
            log.push({
              t: e.t,
              v: e.kind === 'note' ? e.pitch : e.kind === 'trig' ? (e.value ?? 1) : 1,
              vel: e.kind === 'gate' ? 1 : e.vel,
              voice: e.voice,
            });
          }
          if (log.length > LOG_SIZE) log.splice(0, log.length - LOG_SIZE);
        }
      }
    });
  }

  private rateOf(nodeId: string): string | undefined {
    const pn = this.engine.patch.nodes.find((n) => n.id === nodeId);
    return pn ? this.engine.registry.get(pn.module)?.manifest.rate : undefined;
  }

  private timeline(key: string): Timeline | null {
    const [node, port] = key.split('.') as [string, string];
    if (!this.engine.graph.has(node)) return null;
    // le uscite di controllo dei nodi audio arrivano dal worklet, con i loro tempi reali
    if (this.rateOf(node) === 'audio') return this.host.analysisTimeline(key);
    try {
      return this.engine.tap(node, port, 1024);
    } catch {
      return null;
    }
  }

  events(key: string, now: number, seconds: number): LoggedEvent[] {
    const log = this.logs.get(key);
    if (!log) return [];
    return log.filter((e) => e.t <= now && e.t > now - seconds);
  }

  value(key: string, now: number): number {
    const tl = this.timeline(key);
    return tl?.size ? tl.sample(now) : 0;
  }

  /** Tutte le voci di un'uscita (fino a 16), all'istante indicato. */
  voices(key: string, now: number): number[] {
    const [node, port] = key.split('.') as [string, string];
    if (!this.engine.graph.has(node)) return [];
    const buf = this.engine.graph.output(node, port);
    const n = Math.min(16, buf.type === 'phase' ? buf.end.length : buf.type === 'control' ? buf.values.length : 1);
    let tl: Timeline;
    try {
      tl = this.engine.tap(node, port, 512, 16);
    } catch {
      return [];
    }
    if (!tl.size) return [];
    return Array.from({ length: n }, (_, v) => tl.sample(now, v));
  }

  history(key: string, now: number, seconds: number, n: number): number[] {
    const tl = this.timeline(key);
    if (!tl?.size) return [];
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) out[i] = tl.sample(now - seconds + (seconds * i) / (n - 1));
    return out;
  }

  sourceOf(nodeId: string, port: string): string | undefined {
    return this.engine.patch.connections.find((c) => c.to === `${nodeId}.${port}`)?.from;
  }

  context(nodeId: string, now: number): ViewContext {
    const engine = this.engine;
    const node = () => engine.graph.node(nodeId);
    const src = (port: string) => this.sourceOf(nodeId, port);
    const self = this;
    return {
      nodeId,
      seed: node().seed,
      now,
      param: (id) => node().params.value(id),
      normalized: (id) => node().params.normalized(id),
      state<T>() {
        const cached = self.states.get(nodeId);
        if (cached && now - cached.at < 0.1 && now >= cached.at) return cached.state as T;
        const state = cloneJson(node().instance.getState());
        self.states.set(nodeId, { at: now, state });
        return state as T;
      },
      config<T>() {
        const pn = engine.patch.nodes.find((n) => n.id === nodeId);
        return (pn?.config ?? node().def.defaultConfig) as T;
      },
      events: (port, seconds) => this.events(`${nodeId}.${port}`, now, seconds),
      value: (port) => this.value(`${nodeId}.${port}`, now),
      voices: (port) => this.voices(`${nodeId}.${port}`, now),
      history: (port, seconds, n) => this.history(`${nodeId}.${port}`, now, seconds, n),
      scope: (port) => this.host.scopes.get(`${nodeId}.${port}`) ?? null,
      thumbnail: (port) => this.thumbs().get(`${nodeId}.${port}`) ?? null,
      input: {
        events: (port, seconds) => {
          const k = src(port);
          return k ? this.events(k, now, seconds) : [];
        },
        value: (port) => {
          const k = src(port);
          return k ? this.value(k, now) : 0;
        },
        history: (port, seconds, n) => {
          const k = src(port);
          return k ? this.history(k, now, seconds, n) : [];
        },
        scope: (port) => {
          const k = src(port);
          return k ? (this.host.scopes.get(k) ?? null) : null;
        },
        thumbnail: (port) => {
          const k = src(port);
          return k ? (this.thumbs().get(k) ?? null) : null;
        },
      },
    };
  }
}
