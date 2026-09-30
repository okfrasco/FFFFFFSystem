/**
 * Campioni audio condivisi (per Sampler, Granulare, Wavetable da file). La
 * patch porta solo l'id del campione; i dati stanno qui, in memoria, sia nel
 * main sia nell'AudioWorklet (l'host glieli manda). Nel browser si salvano
 * anche in IndexedDB (ui/sampleStore.ts), così sopravvivono al ricaricamento.
 */

export interface Sample {
  id: string;
  name: string;
  sampleRate: number;
  /** Un Float32Array per canale (1 o 2). */
  channels: Float32Array[];
}

const store = new Map<string, Sample>();
const listeners = new Set<(s: Sample) => void>();

export function registerSample(s: Sample): void {
  store.set(s.id, s);
  for (const fn of listeners) fn(s);
}

export function getSample(id: string | undefined): Sample | undefined {
  return id ? store.get(id) : undefined;
}

export function allSamples(): Sample[] {
  return [...store.values()];
}

/** Chiamato a ogni campione registrato (anche per quelli già presenti, subito). */
export function onSample(fn: (s: Sample) => void): () => void {
  listeners.add(fn);
  for (const s of store.values()) fn(s);
  return () => listeners.delete(fn);
}

/** Id stabile di un campione: dipende dal contenuto, non dal nome del file. */
export function sampleId(channels: readonly Float32Array[], sampleRate: number): string {
  let h = 2166136261 ^ sampleRate;
  const ch = channels[0] ?? new Float32Array(0);
  h = Math.imul(h ^ ch.length, 16777619);
  const step = Math.max(1, Math.floor(ch.length / 4096));
  for (let i = 0; i < ch.length; i += step) h = Math.imul(h ^ Math.round(ch[i]! * 32767), 16777619);
  return `s${(h >>> 0).toString(36)}${channels.length}`;
}

/** Il campione mono (media dei canali). */
export function mono(s: Sample): Float32Array {
  if (s.channels.length === 1) return s.channels[0]!;
  const n = s.channels[0]!.length;
  const out = new Float32Array(n);
  for (const ch of s.channels) for (let i = 0; i < n; i++) out[i]! += ch[i]! / s.channels.length;
  return out;
}
