/**
 * Allocazione e lettura dei buffer di segnale.
 *
 * Regole dei buffer di uscita (vedi `Outputs` in types.ts):
 * - gli eventi si svuotano all'inizio di ogni `process` del nodo che li produce;
 * - i valori restano quelli del tick precedente finché il nodo non li riscrive,
 *   quindi una fase può ripartire da `end` del tick prima;
 * - chiedere un numero di voci diverso rialloca il buffer (azzerato).
 */

import type {
  AudioBlock,
  ControlBuffer,
  ControlEvent,
  PhaseBuffer,
  PortType,
  SignalBuffer,
  TextureRef,
} from './types';

export function createPhase(voices = 1): PhaseBuffer {
  return { type: 'phase', start: new Float64Array(voices), end: new Float64Array(voices) };
}

export function createControl(voices = 1): ControlBuffer {
  return { type: 'control', values: new Float32Array(voices), events: [] };
}

export function createAudio(voices = 1, frames = 128): AudioBlock {
  return { type: 'audio', channels: Array.from({ length: voices }, () => new Float32Array(frames)) };
}

export function createTexture(): TextureRef {
  return { type: 'texture', width: 0, height: 0, handle: null };
}

export function createBuffer(type: PortType, voices = 1): SignalBuffer {
  switch (type) {
    case 'phase':
      return createPhase(voices);
    case 'control':
      return createControl(voices);
    case 'audio':
      return createAudio(voices);
    case 'texture':
      return createTexture();
  }
}

/** Legge la voce `v` con avvolgimento, come mc in Max: 3 voci lette da 5 → 0,1,2,0,1. */
export function readVoice(arr: ArrayLike<number>, v: number): number {
  const n = arr.length;
  if (n === 0) return 0;
  return arr[((v % n) + n) % n] as number;
}

/** Svuota gli eventi di un buffer di uscita (inizio del process del produttore). */
export function clearEvents(buf: SignalBuffer): void {
  if (buf.type === 'control') buf.events.length = 0;
}

/**
 * Somma più buffer di controllo in `into`: valori sommati voce per voce
 * (con avvolgimento), eventi concatenati e ordinati per tempo.
 */
export function mergeControl(into: ControlBuffer, sources: readonly ControlBuffer[]): ControlBuffer {
  let voices = 1;
  for (const s of sources) voices = Math.max(voices, s.values.length);
  if (into.values.length !== voices) into.values = new Float32Array(voices);
  else into.values.fill(0);
  into.events.length = 0;
  for (const s of sources) {
    for (let v = 0; v < voices; v++) into.values[v]! += readVoice(s.values, v);
    for (const e of s.events) into.events.push(e);
  }
  if (sources.length > 1) into.events.sort(byTime);
  return into;
}

export function byTime(a: ControlEvent, b: ControlEvent): number {
  return a.t - b.t;
}

/**
 * Somma più blocchi audio in `into`: voce per voce con avvolgimento, sulla
 * lunghezza del blocco più lungo.
 */
export function mergeAudio(into: AudioBlock, sources: readonly AudioBlock[]): AudioBlock {
  let voices = 1;
  let frames = 0;
  for (const s of sources) {
    voices = Math.max(voices, s.channels.length);
    frames = Math.max(frames, s.channels[0]?.length ?? 0);
  }
  if (into.channels.length !== voices || (into.channels[0]?.length ?? -1) !== frames) {
    into.channels = Array.from({ length: voices }, () => new Float32Array(frames));
  } else {
    for (const ch of into.channels) ch.fill(0);
  }
  for (const s of sources) {
    const n = s.channels.length;
    if (n === 0) continue;
    for (let v = 0; v < voices; v++) {
      const src = s.channels[v % n] as Float32Array;
      const dst = into.channels[v] as Float32Array;
      for (let i = 0; i < src.length && i < dst.length; i++) dst[i]! += src[i]!;
    }
  }
  return into;
}

/** Eventi di una voce (un ingresso mono vale per tutte le voci). */
export function eventsOf(buf: ControlBuffer | undefined, v: number): ControlEvent[] {
  if (!buf) return [];
  const n = buf.values.length;
  return n <= 1 ? buf.events : buf.events.filter((e) => e.voice % n === v % n);
}

/** L'evento accende (trigger, nota, apertura di gate)? */
export function isOn(e: ControlEvent): boolean {
  return e.kind !== 'gate' || e.on;
}
