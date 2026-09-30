/**
 * Grafo: istanzia i moduli di una patch, valida le connessioni tipizzate,
 * ordina l'esecuzione e processa un tick alla volta.
 *
 * Ordine: topologico sulle dipendenze (sorgente prima del consumatore),
 * visitando i nodi nell'ordine della patch così il risultato è stabile.
 * Le connessioni che chiudono un ciclo non sono un errore: il consumatore gira
 * prima del produttore e legge il suo buffer del tick precedente (1 tick di
 * ritardo). È il feedback che serve ad Accoppiamento e Memoria.
 */

import { ParamStore } from './params';
import type { Registry } from './registry';
import { Rng, hash01, hash32, hashString } from './rng';
import { clearEvents, createAudio, createBuffer, createControl, mergeAudio, mergeControl } from './signals';
import { Timeline } from './timeline';
import type {
  AudioBlock,
  ControlBuffer,
  ControlSignal,
  Inputs,
  ModuleDefinition,
  ModuleInstance,
  ModuleRate,
  Outputs,
  Patch,
  PhaseBuffer,
  PortSpec,
  PortType,
  ProcessContext,
  SignalBuffer,
  TextureRef,
} from './types';
import { cloneJson, voiceCount } from './types';

export class GraphError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Patch non valida:\n  ${errors.join('\n  ')}`);
    this.errors = errors;
  }
}

/** Estremo di connessione analizzato. */
export type ParsedEndpoint = { node: string; port: string } | { node: string; param: string };

export function parseEndpoint(ep: string): ParsedEndpoint | null {
  const dot = ep.indexOf('.');
  if (dot <= 0 || dot === ep.length - 1) return null;
  const node = ep.slice(0, dot);
  const rest = ep.slice(dot + 1);
  if (rest.startsWith('param:')) {
    const param = rest.slice('param:'.length);
    return param ? { node, param } : null;
  }
  if (rest.includes('.') || rest.includes(':')) return null;
  return { node, port: rest };
}

/**
 * Compatibilità dei sottotipi di controllo: un ingresso 'value' legge i valori
 * di qualunque segnale; 'gate' ed 'event' vogliono eventi con tempo, quindi
 * accettano solo gate o event.
 */
export function signalCompatible(from: ControlSignal, to: ControlSignal): boolean {
  if (to === 'value') return true;
  return from === 'gate' || from === 'event';
}

export interface DelayedEdge {
  from: string;
  to: string;
}

export class NodeContext implements ProcessContext {
  t0 = 0;
  t1 = 0;
  dt = 0;
  tick = 0;
  sampleRate = 0;
  frames = 0;
  gl?: WebGL2RenderingContext;

  constructor(
    readonly rate: ModuleRate,
    readonly rng: Rng,
    private readonly params: ParamStore,
    public config: unknown,
  ) {}

  /**
   * Morph probabilistico dei parametri discreti: per ogni parametro in morph
   * i valori di A e B; `morphP` è il progresso. Ogni evento ha una soglia fissa
   * hash(seed, parametro, evento): segue B quando il progresso la supera.
   */
  morph: Map<string, { a: number; b: number; hash: number }> | null = null;
  morphP = 0;
  morphSeed = 0;

  param(id: string, voice = 0): number {
    return this.params.value(id, voice);
  }

  discrete(id: string, eventKey: number, voice = 0): number {
    const m = this.morph?.get(id);
    if (m) return hash01(this.morphSeed, m.hash, eventKey, voice) < this.morphP ? m.b : m.a;
    return this.params.value(id, voice);
  }
}

/**
 * Istanza "ombra" di un nodo durante un morph di seed: stesso modulo, stessi
 * ingressi e parametri, seed di B. Le uscite delle due versioni si mescolano
 * con probabilità `p` (vedi mergeShadow).
 */
export interface Shadow {
  seed: number;
  instance: ModuleInstance;
  ctx: NodeContext;
  outputs: NodeOutputs;
  p: number;
}

class NodeInputs implements Inputs {
  /** porta → buffer della sorgente (letto a ogni tick: il produttore può riallocare). */
  readonly resolved = new Map<string, () => SignalBuffer>();

  constructor(
    private readonly nodeId: string,
    private readonly ports: ReadonlyMap<string, PortSpec>,
  ) {}

  phase(id: string): PhaseBuffer | undefined {
    return this.get(id, 'phase') as PhaseBuffer | undefined;
  }
  control(id: string): ControlBuffer | undefined {
    return this.get(id, 'control') as ControlBuffer | undefined;
  }
  audio(id: string): AudioBlock | undefined {
    return this.get(id, 'audio') as AudioBlock | undefined;
  }
  texture(id: string): TextureRef | undefined {
    return this.get(id, 'texture') as TextureRef | undefined;
  }

  private get(id: string, type: PortType): SignalBuffer | undefined {
    const spec = this.ports.get(id);
    if (!spec) throw new Error(`${this.nodeId}: ingresso sconosciuto ${id}`);
    if (spec.type !== type) throw new Error(`${this.nodeId}: ingresso ${id} è ${spec.type}, non ${type}`);
    return this.resolved.get(id)?.();
  }
}

class NodeOutputs implements Outputs {
  readonly buffers = new Map<string, SignalBuffer>();

  constructor(
    private readonly nodeId: string,
    private readonly ports: ReadonlyMap<string, PortSpec>,
  ) {
    for (const p of ports.values()) this.buffers.set(p.id, createBuffer(p.type));
  }

  phase(id: string, voices?: number): PhaseBuffer {
    return this.get(id, 'phase', voices) as PhaseBuffer;
  }
  control(id: string, voices?: number): ControlBuffer {
    return this.get(id, 'control', voices) as ControlBuffer;
  }
  audio(id: string, voices?: number): AudioBlock {
    return this.get(id, 'audio', voices) as AudioBlock;
  }
  texture(id: string): TextureRef {
    return this.get(id, 'texture', undefined) as TextureRef;
  }

  private get(id: string, type: PortType, voices: number | undefined): SignalBuffer {
    const spec = this.ports.get(id);
    if (!spec) throw new Error(`${this.nodeId}: uscita sconosciuta ${id}`);
    if (spec.type !== type) throw new Error(`${this.nodeId}: uscita ${id} è ${spec.type}, non ${type}`);
    let buf = this.buffers.get(id) as SignalBuffer;
    if (voices !== undefined && voices !== voiceCount(buf)) {
      if (voices < 1 || !Number.isInteger(voices)) throw new Error(`${this.nodeId}.${id}: voci non valide ${voices}`);
      if (voices > 1 && !spec.poly) throw new Error(`${this.nodeId}.${id}: porta non poly`);
      buf = createBuffer(type, voices);
      this.buffers.set(id, buf);
    }
    return buf;
  }
}

export interface GraphNode {
  readonly id: string;
  readonly def: ModuleDefinition;
  readonly instance: ModuleInstance;
  readonly params: ParamStore;
  readonly seed: number;
  readonly ctx: NodeContext;
  readonly inputs: NodeInputs;
  readonly outputs: NodeOutputs;
  /** Istanza con il seed di B durante un morph di seed. */
  shadow?: Shadow | undefined;
  /** Ingressi di controllo o audio con più sorgenti: sommati prima del process. */
  readonly merges: ({ buffer: ControlBuffer; sources: (() => ControlBuffer)[] } | { buffer: AudioBlock; sources: (() => AudioBlock)[] })[];
}

interface Tap {
  timeline: Timeline;
  read: () => SignalBuffer;
}

export interface GraphOptions {
  /** Grafo in uso da cui riprendere lo stato dei nodi. */
  reuse?: Graph;
  /** Rate dei nodi che `process` fa girare. Default 'control'. */
  rate?: ModuleRate;
  /** Formato dei blocchi audio (solo con rate 'audio'). */
  audio?: { sampleRate: number; frames: number };
  /** Contesto WebGL per i nodi visual (solo con rate 'frame'). */
  gl?: WebGL2RenderingContext;
}

export class Graph {
  /** Nodi nell'ordine di esecuzione. */
  readonly order: readonly GraphNode[];
  readonly delayedEdges: readonly DelayedEdge[];
  private readonly byId: ReadonlyMap<string, GraphNode>;
  /** Nodi che `process` fa girare (quelli del rate del grafo), in ordine. */
  private readonly runOrder: readonly GraphNode[];
  private readonly taps: Tap[] = [];
  private tickCount = 0;

  private constructor(order: GraphNode[], delayed: DelayedEdge[], opts: GraphOptions) {
    this.order = order;
    this.delayedEdges = delayed;
    this.byId = new Map(order.map((n) => [n.id, n]));
    const rate = opts.rate ?? 'control';
    this.runOrder = order.filter((n) => n.def.manifest.rate === rate);
    for (const n of this.runOrder) {
      if (opts.audio) {
        n.ctx.sampleRate = opts.audio.sampleRate;
        n.ctx.frames = opts.audio.frames;
      }
      if (opts.gl) n.ctx.gl = opts.gl;
    }
  }

  /**
   * Costruisce il grafo di una patch. Con `reuse` (il grafo che sta suonando)
   * i nodi con stesso id, modulo e seed tengono istanza, RNG e buffer di uscita:
   * modificare la patch mentre suona non azzera memorie, catene e fasi.
   * Se la patch non è valida lancia GraphError senza toccare il grafo in uso.
   */
  static build(patch: Patch, registry: Registry, opts: GraphOptions = {}): Graph {
    const errs: string[] = [];
    const reconfigure: { instance: ModuleInstance; config: unknown }[] = [];
    const nodes = new Map<string, GraphNode>();
    const deps = new Map<string, string[]>(); // consumatore → sorgenti, in ordine di connessione

    for (const pn of patch.nodes) {
      if (!pn.id || pn.id.includes('.')) {
        errs.push(`id di nodo non valido: "${pn.id}"`);
        continue;
      }
      if (nodes.has(pn.id)) {
        errs.push(`nodo duplicato: ${pn.id}`);
        continue;
      }
      const def = registry.get(pn.module);
      if (!def) {
        errs.push(`${pn.id}: modulo sconosciuto ${pn.module}`);
        continue;
      }
      const m = def.manifest;
      let params: ParamStore;
      try {
        params = new ParamStore(m.params, pn.params);
      } catch (e) {
        errs.push(`${pn.id}: ${(e as Error).message}`);
        continue;
      }
      const seed = pn.seed ?? hash32(patch.seed, hashString(pn.id));
      const config = cloneJson(pn.config ?? def.defaultConfig ?? null);
      const prev = opts.reuse?.byId.get(pn.id);
      let instance: ModuleInstance;
      let rng: Rng;
      let outputs: NodeOutputs;
      // a fine morph di seed il nodo prende il seed dell'ombra: si riusa l'ombra
      const from = prev && prev.def === def ? (prev.seed === seed ? prev : prev.shadow?.seed === seed ? prev.shadow : null) : null;
      if (prev && from) {
        const sameConfig = JSON.stringify(from.ctx.config) === JSON.stringify(config);
        if (sameConfig || from.instance.setConfig) {
          instance = from.instance;
          if (!sameConfig) reconfigure.push({ instance, config });
        } else {
          instance = def.create({ seed, config });
        }
        rng = from.ctx.rng;
        outputs = prev.outputs;
      } else {
        instance = def.create({ seed, config });
        rng = new Rng(seed);
        outputs = new NodeOutputs(pn.id, new Map(m.outputs.map((p) => [p.id, p])));
      }
      const node: GraphNode = {
        id: pn.id,
        def,
        instance,
        params,
        seed,
        ctx: new NodeContext(m.rate, rng, params, config),
        inputs: new NodeInputs(pn.id, new Map(m.inputs.map((p) => [p.id, p]))),
        outputs,
        merges: [],
      };
      nodes.set(pn.id, node);
      deps.set(pn.id, []);
    }

    // Connessioni: raccolte per ingresso, poi risolte (serve sapere il fan-in).
    const byInput = new Map<string, { node: GraphNode; port: PortSpec; sources: (() => SignalBuffer)[] }>();
    const seen = new Set<string>();

    for (const c of patch.connections) {
      const label = `${c.from} → ${c.to}`;
      if (seen.has(`${c.from}>${c.to}`)) {
        errs.push(`${label}: connessione duplicata`);
        continue;
      }
      seen.add(`${c.from}>${c.to}`);
      const from = parseEndpoint(c.from);
      const to = parseEndpoint(c.to);
      if (!from || !('port' in from)) {
        errs.push(`${label}: sorgente non valida`);
        continue;
      }
      if (!to) {
        errs.push(`${label}: destinazione non valida`);
        continue;
      }
      const src = nodes.get(from.node);
      const dst = nodes.get(to.node);
      if (!src || !dst) {
        errs.push(`${label}: nodo inesistente`);
        continue;
      }
      const outSpec = src.def.manifest.outputs.find((p) => p.id === from.port);
      if (!outSpec) {
        errs.push(`${label}: ${src.id} non ha l'uscita ${from.port}`);
        continue;
      }
      const read = (): SignalBuffer => src.outputs.buffers.get(outSpec.id) as SignalBuffer;

      if ('param' in to) {
        if (!dst.params.has(to.param)) {
          errs.push(`${label}: ${dst.id} non ha il parametro ${to.param}`);
          continue;
        }
        if (outSpec.type !== 'control') {
          errs.push(`${label}: solo un segnale di controllo modula un parametro (è ${outSpec.type})`);
          continue;
        }
        dst.params.addModulation(to.param, { source: read as () => ControlBuffer, amount: c.amount ?? 1 });
      } else {
        const inSpec = dst.def.manifest.inputs.find((p) => p.id === to.port);
        if (!inSpec) {
          errs.push(`${label}: ${dst.id} non ha l'ingresso ${to.port}`);
          continue;
        }
        if (inSpec.type !== outSpec.type) {
          errs.push(`${label}: tipo ${outSpec.type} → ${inSpec.type}`);
          continue;
        }
        if (
          inSpec.type === 'control' &&
          !signalCompatible(outSpec.signal ?? 'value', inSpec.signal ?? 'value')
        ) {
          errs.push(`${label}: segnale ${outSpec.signal ?? 'value'} → ${inSpec.signal ?? 'value'}`);
          continue;
        }
        if (c.amount !== undefined) {
          errs.push(`${label}: amount vale solo verso un parametro`);
          continue;
        }
        const key = `${dst.id}.${inSpec.id}`;
        let entry = byInput.get(key);
        if (!entry) byInput.set(key, (entry = { node: dst, port: inSpec, sources: [] }));
        entry.sources.push(read);
      }
      (deps.get(dst.id) as string[]).push(src.id);
    }

    for (const { node, port, sources } of byInput.values()) {
      if (sources.length === 1) {
        node.inputs.resolved.set(port.id, sources[0] as () => SignalBuffer);
      } else if (port.type === 'control') {
        const buffer = createControl();
        node.merges.push({ buffer, sources: sources as (() => ControlBuffer)[] });
        node.inputs.resolved.set(port.id, () => buffer);
      } else if (port.type === 'audio') {
        const buffer = createAudio(1, 0);
        node.merges.push({ buffer, sources: sources as (() => AudioBlock)[] });
        node.inputs.resolved.set(port.id, () => buffer);
      } else {
        errs.push(`${node.id}.${port.id}: un ingresso ${port.type} accetta una sola connessione`);
      }
    }

    if (errs.length) throw new GraphError(errs);
    for (const r of reconfigure) r.instance.setConfig?.(r.config);

    // Ordinamento: DFS sulle dipendenze, post-ordine. Un arco verso un nodo
    // ancora in visita chiude un ciclo e diventa un arco ritardato.
    const state = new Map<string, 'visiting' | 'done'>();
    const order: GraphNode[] = [];
    const delayed: DelayedEdge[] = [];
    const visit = (id: string): void => {
      state.set(id, 'visiting');
      for (const s of deps.get(id) as string[]) {
        const st = state.get(s);
        if (st === 'visiting') delayed.push({ from: s, to: id });
        else if (st === undefined) visit(s);
      }
      state.set(id, 'done');
      order.push(nodes.get(id) as GraphNode);
    };
    for (const id of nodes.keys()) if (!state.has(id)) visit(id);

    const graph = new Graph(order, delayed, opts);
    if (opts.reuse) {
      graph.tickCount = opts.reuse.tickCount;
      // chi usava un'istanza che non c'è più la rilascia
      const kept = new Set(order.map((n) => n.instance));
      for (const n of opts.reuse.order) {
        if (!kept.has(n.instance)) n.instance.dispose?.();
        if (n.shadow && !kept.has(n.shadow.instance)) n.shadow.instance.dispose?.();
      }
    }
    return graph;
  }

  get tick(): number {
    return this.tickCount;
  }

  node(id: string): GraphNode {
    const n = this.byId.get(id);
    if (!n) throw new Error(`nodo inesistente: ${id}`);
    return n;
  }

  /** Buffer di un'uscita (per ispezione, test e consumatori esterni). */
  output(nodeId: string, portId: string): SignalBuffer {
    const buf = this.node(nodeId).outputs.buffers.get(portId);
    if (!buf) throw new Error(`${nodeId}: uscita inesistente ${portId}`);
    return buf;
  }

  setParam(nodeId: string, paramId: string, value: number): void {
    this.node(nodeId).params.setBase(paramId, value);
  }

  getParam(nodeId: string, paramId: string): number {
    return this.node(nodeId).params.getBase(paramId);
  }

  /**
   * Registra un'uscita in una Timeline a ogni tick (al tempo t1): la fase
   * come valore srotolato, il controllo come valori per voce.
   */
  tap(nodeId: string, portId: string, capacity = 256, voices = 1): Timeline {
    const timeline = new Timeline(capacity, voices);
    this.attachTap(nodeId, portId, timeline);
    return timeline;
  }

  /** Collega una Timeline esistente (es. dopo una ricostruzione del grafo). */
  attachTap(nodeId: string, portId: string, timeline: Timeline): void {
    this.output(nodeId, portId); // valida
    const n = this.node(nodeId);
    this.taps.push({ timeline, read: () => n.outputs.buffers.get(portId) as SignalBuffer });
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Avvia (o toglie, con null) l'istanza ombra di un nodo con un altro seed.
   * L'ombra parte dallo stato attuale del nodo, così le due versioni
   * divergono solo per la casualità.
   */
  setShadow(nodeId: string, seed: number | null): void {
    const n = this.node(nodeId);
    if (seed === null) {
      if (n.shadow) n.shadow.instance.dispose?.();
      n.shadow = undefined;
      return;
    }
    if (n.shadow?.seed === seed) return;
    const config = cloneJson(n.ctx.config);
    const instance = n.def.create({ seed, config });
    instance.setState(cloneJson(n.instance.getState()));
    const ctx = new NodeContext(n.def.manifest.rate, new Rng(seed), n.params, config);
    ctx.sampleRate = n.ctx.sampleRate;
    ctx.frames = n.ctx.frames;
    const outputs = new NodeOutputs(nodeId, new Map(n.def.manifest.outputs.map((p) => [p.id, p])));
    n.shadow = { seed, instance, ctx, outputs, p: 0 };
  }

  /** Processa un tick (o un blocco audio) che copre [t0, t1). */
  process(t0: number, t1: number): void {
    const dt = t1 - t0;
    for (const n of this.runOrder) {
      const ctx = n.ctx;
      ctx.t0 = t0;
      ctx.t1 = t1;
      ctx.dt = dt;
      ctx.tick = this.tickCount;
      for (const m of n.merges) {
        if (m.buffer.type === 'control') mergeControl(m.buffer, (m.sources as (() => ControlBuffer)[]).map((s) => s()));
        else mergeAudio(m.buffer, (m.sources as (() => AudioBlock)[]).map((s) => s()));
      }
      for (const b of n.outputs.buffers.values()) clearEvents(b);
      n.instance.process(ctx, n.inputs, n.outputs);
      const sh = n.shadow;
      if (sh) {
        const sc = sh.ctx;
        sc.t0 = t0;
        sc.t1 = t1;
        sc.dt = dt;
        sc.tick = this.tickCount;
        sc.morph = ctx.morph;
        sc.morphP = ctx.morphP;
        sc.morphSeed = ctx.morphSeed;
        for (const b of sh.outputs.buffers.values()) clearEvents(b);
        sh.instance.process(sc, n.inputs, sh.outputs);
        mergeShadow(n.outputs, sh.outputs, sh.p, n.seed);
      }
    }
    for (const tap of this.taps) {
      const buf = tap.read();
      if (buf.type === 'phase') tap.timeline.push(t1, buf.end);
      else if (buf.type === 'control') tap.timeline.push(t1, buf.values);
    }
    this.tickCount++;
  }

  dispose(): void {
    for (const n of this.order) n.instance.dispose?.();
  }
}

/**
 * Fonde le uscite di un nodo con quelle della sua ombra. Eventi: ognuno ha una
 * soglia fissa hash(seed, tempo, voce); quelli di A restano se la soglia è ≥ p,
 * quelli di B entrano se è < p. Un colpo che c'è in entrambe le versioni
 * compare una volta sola. Valori: interpolati; fasi: dalla versione prevalente.
 */
export function mergeShadow(a: NodeOutputs, b: NodeOutputs, p: number, seed: number): void {
  const u = (t: number, voice: number) => hash01(seed, Math.round(t * 1e5), voice);
  for (const [id, bufA] of a.buffers) {
    const bufB = b.buffers.get(id);
    if (!bufB || bufA.type !== bufB.type) continue;
    if (bufA.type === 'control' && bufB.type === 'control') {
      const kept = bufA.events.filter((e) => u(e.t, e.voice) >= p);
      for (const e of bufB.events) if (u(e.t, e.voice) < p) kept.push(e);
      kept.sort((x, y) => x.t - y.t);
      bufA.events = kept;
      const n = Math.min(bufA.values.length, bufB.values.length);
      for (let v = 0; v < n; v++) bufA.values[v] = bufA.values[v]! + (bufB.values[v]! - bufA.values[v]!) * p;
    } else if (bufA.type === 'phase' && bufB.type === 'phase' && p >= 0.5) {
      bufA.start.set(bufB.start.subarray(0, bufA.start.length));
      bufA.end.set(bufB.end.subarray(0, bufA.end.length));
    }
  }
}
