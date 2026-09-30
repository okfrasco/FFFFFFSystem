/**
 * Contratto del sistema: tipi di segnale, manifest dei moduli, contesto di
 * processo e formato della patch. È la fonte di verità in codice di SPEC.md
 * (sezione "Contratto del modulo"): se cambia qui, cambia anche lì.
 *
 * Nessuna dipendenza dal DOM oltre al contesto WebGL dei nodi visual, così il
 * core resta portabile (browser oggi, plugin domani).
 */

import type { Rng } from './rng';

// ─── Porte e segnali ──────────────────────────────────────────────────────

export type PortType = 'phase' | 'control' | 'audio' | 'texture';

/**
 * Sottotipo di una porta di controllo. Non cambia la forma del buffer: serve a
 * validare le connessioni e a disegnare la UI.
 * - value: valori continui (0–1 o bipolari)
 * - gate:  livello 0/1, con gli eventi 'gate' ai fronti
 * - event: trigger e note con timestamp
 */
export type ControlSignal = 'value' | 'gate' | 'event';

export interface PortSpec {
  id: string;
  type: PortType;
  /** La porta porta N voci; ogni voce conosce il proprio indice. */
  poly?: boolean;
  /** Solo per type 'control'. Default 'value'. */
  signal?: ControlSignal;
}

/**
 * Fase "srotolata" per un tick: float64 che cresce (o cala) senza avvolgersi.
 * Parte intera = ciclo corrente, parte frazionaria = rampa 0→1.
 * Dentro il tick la fase è lineare tra start ed end, quindi l'istante esatto
 * in cui attraversa uno step si ottiene per interpolazione (vedi `crossingTime`).
 * Tra un tick e il successivo la fase può saltare (start ≠ end precedente,
 * es. Ø Scale che cambia rapporto): i consumatori guardano solo [start, end).
 */
export interface PhaseBuffer {
  readonly type: 'phase';
  /** Valore all'inizio del tick (t0), una voce per elemento. */
  start: Float64Array;
  /** Valore alla fine del tick (t1). */
  end: Float64Array;
}

/** Trigger istantaneo. */
export interface TrigEvent {
  kind: 'trig';
  /** Tempo assoluto in secondi, sul clock dell'AudioContext, in [t0, t1). */
  t: number;
  voice: number;
  /** 0–1. */
  vel: number;
  /**
   * Valore portato dal trigger nello stesso istante (es. il grado scelto da
   * Markov): chi lo consuma non deve campionare un ingresso a parte.
   */
  value?: number;
}

/** Fronte di un gate. */
export interface GateEvent {
  kind: 'gate';
  t: number;
  voice: number;
  on: boolean;
}

/** Nota con durata: la note-off la programma chi la consuma (es. MIDI Out). */
export interface NoteEvent {
  kind: 'note';
  t: number;
  voice: number;
  /** Altezza MIDI, anche frazionaria (microtonalità a valle). */
  pitch: number;
  /** 0–1. */
  vel: number;
  /** Durata in secondi. */
  dur: number;
}

export type ControlEvent = TrigEvent | GateEvent | NoteEvent;

/**
 * Buffer di controllo per un tick: valori per voce alla fine del tick più gli
 * eventi del tick, ordinati per tempo.
 */
export interface ControlBuffer {
  readonly type: 'control';
  values: Float32Array;
  events: ControlEvent[];
}

/** Audio: un blocco di campioni per voce. */
export interface AudioBlock {
  readonly type: 'audio';
  channels: Float32Array[];
}

/** Riferimento opaco a una texture GPU, gestito dal renderer. */
export interface TextureRef {
  readonly type: 'texture';
  width: number;
  height: number;
  handle: unknown;
}

export type SignalBuffer = PhaseBuffer | ControlBuffer | AudioBlock | TextureRef;

/** Numero di voci di un buffer. */
export function voiceCount(buf: SignalBuffer): number {
  switch (buf.type) {
    case 'phase':
      return buf.end.length;
    case 'control':
      return buf.values.length;
    case 'audio':
      return buf.channels.length;
    case 'texture':
      return 1;
  }
}

// ─── Parametri ────────────────────────────────────────────────────────────

export interface ParamSpec {
  id: string;
  min: number;
  max: number;
  default: number;
  /** continuous = si interpola; discrete = si morpha in modo probabilistico. */
  kind: 'continuous' | 'discrete';
  /** Curva di mappatura tra spazio normalizzato 0–1 e valore. Default 'lin'. */
  curve?: 'lin' | 'exp';
  /** Etichette per parametri a scelta: il valore è l'indice (min 0, max n-1). */
  options?: string[];
  /** Nome leggibile; se manca si usa l'id. */
  label?: string;
  unit?: string;
}

// ─── Manifest, istanza, factory ───────────────────────────────────────────

export type ModuleCategory =
  | 'phase'
  | 'generators'
  | 'logic'
  | 'transform'
  | 'harmony'
  | 'audio'
  | 'effects'
  | 'visual'
  | 'io';

/**
 * A che rate l'host chiama `process`: 'control' nel main thread a tick di
 * controllo, 'audio' nell'AudioWorklet a blocchi di campioni, 'frame' al
 * rendering dei visual.
 */
export type ModuleRate = 'control' | 'audio' | 'frame';

export interface ModuleManifest {
  id: string;
  name: string;
  category: ModuleCategory;
  rate: ModuleRate;
  inputs: PortSpec[];
  outputs: PortSpec[];
  params: ParamSpec[];
  /** Il modulo usa `ctx.rng`: il seed fa parte della scena e si può morphare. */
  seeded: boolean;
}

/**
 * Tempo e servizi che l'host passa a ogni chiamata di `process`.
 * Per i nodi 'control' un tick copre [t0, t1); per i nodi 'audio' un blocco di
 * `frames` campioni che inizia a t0 (un evento a tempo t cade al campione
 * (t − t0) · sampleRate); per i nodi 'frame' t0 = t1 è l'istante del frame.
 *
 * I moduli audio vengono istanziati anche nel main thread (per l'editor) ma
 * lì non girano: allocano le loro memorie (linee di ritardo…) al primo process.
 */
export interface ProcessContext {
  /** Inizio del tick, secondi sul clock dell'AudioContext. */
  readonly t0: number;
  /** Fine del tick. */
  readonly t1: number;
  /** t1 - t0. */
  readonly dt: number;
  /** Contatore dei tick (o dei frame) da quando il grafo è partito. */
  readonly tick: number;
  readonly rate: ModuleRate;
  /** Solo per i nodi 'audio': frequenza di campionamento e campioni del blocco (0 altrimenti). */
  readonly sampleRate: number;
  readonly frames: number;
  /** RNG del nodo, derivato dal suo seed. Unica casualità ammessa. */
  readonly rng: Rng;
  /**
   * Valore effettivo di un parametro continuo: base + modulazione + morph,
   * già mappato con la curva. Con `voice` legge il valore di quella voce.
   */
  param(id: string, voice?: number): number;
  /**
   * Valore di un parametro discreto per un evento. `eventKey` identifica
   * l'evento in modo stabile (es. indice di step srotolato): durante un morph
   * probabilistico lo stesso evento riceve sempre la stessa scelta A/B, e una
   * volta passato a B ci resta mentre il morph avanza.
   */
  discrete(id: string, eventKey: number, voice?: number): number;
  /** Configurazione non numerica del nodo (regole, tabelle, matrici). */
  readonly config: unknown;
  /** Solo per i nodi 'frame'. */
  readonly gl?: WebGL2RenderingContext;
}

/** Ingressi di un nodo. `undefined` se la porta non è collegata. */
export interface Inputs {
  phase(id: string): PhaseBuffer | undefined;
  control(id: string): ControlBuffer | undefined;
  audio(id: string): AudioBlock | undefined;
  texture(id: string): TextureRef | undefined;
}

/**
 * Uscite di un nodo. Le porte poly accettano `voices` per dimensionare il
 * buffer; il buffer restituito è già azzerato (e senza eventi) per questo tick.
 */
export interface Outputs {
  phase(id: string, voices?: number): PhaseBuffer;
  control(id: string, voices?: number): ControlBuffer;
  audio(id: string, voices?: number): AudioBlock;
  texture(id: string): TextureRef;
}

export interface ModuleInstance {
  process(ctx: ProcessContext, inputs: Inputs, outputs: Outputs): void;
  /** Stato interno serializzabile in JSON (memorie, posizioni, catene). */
  getState(): unknown;
  setState(state: unknown): void;
  /** Chiamato quando la config cambia (patch, scena, morph discreto). */
  setConfig?(config: unknown): void;
  /** Rilascia risorse (es. texture GPU). */
  dispose?(): void;
}

export interface ModuleInit {
  seed: number;
  config: unknown;
}

export interface ModuleDefinition {
  manifest: ModuleManifest;
  create(init: ModuleInit): ModuleInstance;
  /** Config di default quando la patch non la specifica. */
  defaultConfig?: unknown;
}

// ─── Parametri standard dei generatori ────────────────────────────────────

/** Mutazione e Swing: lo stesso linguaggio per tutti i generatori. */
export const STANDARD_GENERATOR_PARAMS: readonly ParamSpec[] = [
  { id: 'mutation', label: 'Mutazione', min: 0, max: 1, default: 0, kind: 'continuous' },
  { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
];

// ─── Patch ────────────────────────────────────────────────────────────────

/** Estremo di una connessione: "nodo.porta" oppure "nodo.param:id". */
export type Endpoint = string;

export interface PatchNode {
  id: string;
  /** Id del modulo nel registry (ModuleManifest.id). */
  module: string;
  seed?: number;
  /** Valori base dei parametri; quelli mancanti prendono il default. */
  params?: Record<string, number>;
  config?: unknown;
  /** Posizione nell'editor a nodi (solo interfaccia, non tocca il suono). */
  ui?: { x: number; y: number };
}

export interface PatchConnection {
  from: Endpoint;
  to: Endpoint;
  /**
   * Solo verso un parametro: profondità di modulazione nello spazio
   * normalizzato, bipolare. Default 1.
   */
  amount?: number;
}

export interface Patch {
  version: 1;
  /** Seed globale: i seed dei nodi senza seed esplicito derivano da qui. */
  seed: number;
  nodes: PatchNode[];
  connections: PatchConnection[];
  /** Scene salvate con la patch (vedi core/scene.ts). */
  scenes?: Scene[];
}

/** Stato di un nodo in una scena. */
export interface SceneNode {
  params: Record<string, number>;
  seed: number;
  config?: unknown;
  /** Stato interno e RNG, se la scena è stata presa con lo stato. */
  state?: unknown;
  rng?: [number, number, number, number];
}

/** Istantanea di parametri, seed e config (ed eventualmente stato) dei nodi. */
export interface Scene {
  name: string;
  nodes: Record<string, SceneNode>;
}

// ─── Helper sulla fase ────────────────────────────────────────────────────

/** Parte frazionaria in [0, 1), corretta anche per valori negativi. */
export function frac(x: number): number {
  return x - Math.floor(x);
}

/**
 * Istante in cui una fase lineare nel tick passa per `target`.
 * Restituisce un tempo in [t0, t1] oppure NaN se non ci passa.
 */
export function crossingTime(
  start: number,
  end: number,
  target: number,
  t0: number,
  t1: number,
): number {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (target < lo || target > hi || start === end) return NaN;
  return t0 + ((target - start) / (end - start)) * (t1 - t0);
}

/** Copia profonda di un valore JSON (va anche dove structuredClone non c'è, es. AudioWorklet). */
export function cloneJson<T>(x: T): T {
  return x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T);
}
