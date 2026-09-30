/**
 * Parametri: mappatura tra spazio normalizzato (0–1) e valore, e store per
 * nodo con modulazione.
 *
 * Tutto ciò che si somma (modulazione, e in M7 l'interpolazione del morph)
 * avviene nello spazio normalizzato, dopo la curva: così un cutoff 'exp'
 * modulato da un LFO si muove in modo percettivamente uniforme.
 */

import type { ControlBuffer, ParamSpec } from './types';
import { readVoice } from './signals';

/** Valore → normalizzato in [0, 1]. */
export function normalize(spec: ParamSpec, value: number): number {
  const { min, max } = spec;
  if (max === min) return 0;
  let n: number;
  if (spec.curve === 'exp') n = Math.log(value / min) / Math.log(max / min);
  else n = (value - min) / (max - min);
  return clamp01(Number.isFinite(n) ? n : 0);
}

/** Normalizzato → valore; i discreti vengono arrotondati all'intero. */
export function denormalize(spec: ParamSpec, n: number): number {
  const c = clamp01(n);
  const { min, max } = spec;
  const v = spec.curve === 'exp' ? min * Math.pow(max / min, c) : min + (max - min) * c;
  return spec.kind === 'discrete' ? Math.round(v) : v;
}

/** Errori di definizione di un parametro (vuoto se è valido). */
export function validateParamSpec(spec: ParamSpec): string[] {
  const errs: string[] = [];
  if (!(spec.max >= spec.min)) errs.push(`${spec.id}: max < min`);
  if (spec.default < spec.min || spec.default > spec.max) errs.push(`${spec.id}: default fuori range`);
  if (spec.curve === 'exp' && !(spec.min > 0)) errs.push(`${spec.id}: curva exp richiede min > 0`);
  if (spec.options && (spec.min !== 0 || spec.max !== spec.options.length - 1 || spec.kind !== 'discrete'))
    errs.push(`${spec.id}: options richiede kind discrete, min 0, max = n-1`);
  return errs;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Una modulazione collegata a un parametro. */
export interface ParamModulation {
  source: () => ControlBuffer;
  amount: number;
}

/**
 * Parametri di un nodo: valore base (normalizzato) + modulazioni.
 * Il valore effettivo si calcola quando il nodo lo chiede, per voce.
 */
export class ParamStore {
  readonly specs: readonly ParamSpec[];
  private readonly index = new Map<string, number>();
  private readonly base: Float64Array;
  private readonly mods: ParamModulation[][];

  constructor(specs: readonly ParamSpec[], initial: Record<string, number> = {}) {
    this.specs = specs;
    this.base = new Float64Array(specs.length);
    this.mods = specs.map(() => []);
    specs.forEach((s, i) => {
      this.index.set(s.id, i);
      this.base[i] = normalize(s, initial[s.id] ?? s.default);
    });
    for (const id of Object.keys(initial)) {
      if (!this.index.has(id)) throw new Error(`parametro sconosciuto: ${id}`);
    }
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  indexOf(id: string): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`parametro sconosciuto: ${id}`);
    return i;
  }

  spec(id: string): ParamSpec {
    return this.specs[this.indexOf(id)] as ParamSpec;
  }

  /** Valore base (senza modulazione), nelle unità del parametro. */
  getBase(id: string): number {
    const i = this.indexOf(id);
    return denormalize(this.specs[i] as ParamSpec, this.base[i] as number);
  }

  setBase(id: string, value: number): void {
    const i = this.indexOf(id);
    this.base[i] = normalize(this.specs[i] as ParamSpec, value);
  }

  getBaseNormalized(id: string): number {
    return this.base[this.indexOf(id)] as number;
  }

  setBaseNormalized(id: string, n: number): void {
    this.base[this.indexOf(id)] = clamp01(n);
  }

  addModulation(id: string, mod: ParamModulation): void {
    (this.mods[this.indexOf(id)] as ParamModulation[]).push(mod);
  }

  /** Normalizzato effettivo: base + Σ amount · valore della sorgente, clamp. */
  normalized(id: string, voice = 0): number {
    const i = this.indexOf(id);
    let n = this.base[i] as number;
    for (const m of this.mods[i] as ParamModulation[]) n += m.amount * readVoice(m.source().values, voice);
    return clamp01(n);
  }

  /** Valore effettivo nelle unità del parametro. */
  value(id: string, voice = 0): number {
    return denormalize(this.spec(id), this.normalized(id, voice));
  }

  /** Valori base di tutti i parametri, nelle loro unità (per patch e scene). */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    this.specs.forEach((s, i) => (out[s.id] = denormalize(s, this.base[i] as number)));
    return out;
  }
}
