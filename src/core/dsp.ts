/** Funzioni DSP comuni ai moduli audio. */

import type { ControlEvent, ProcessContext } from './types';

/** Campione del blocco in cui cade un evento (clamp dentro il blocco). */
export function eventFrame(ctx: ProcessContext, t: number): number {
  // la tolleranza evita che un evento esattamente su un campione (es. 0.02 s)
  // finisca sul precedente per un errore di arrotondamento
  const f = Math.floor((t - ctx.t0) * ctx.sampleRate + 1e-6);
  return f < 0 ? 0 : f >= ctx.frames ? ctx.frames - 1 : f;
}

/** Eventi ordinati per campione, con il campione già calcolato. */
export function framedEvents(ctx: ProcessContext, events: readonly ControlEvent[]): { f: number; e: ControlEvent }[] {
  return events.map((e) => ({ f: eventFrame(ctx, e.t), e })).sort((a, b) => a.f - b.f);
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Correzione polyBLEP per le discontinuità di saw e square (t = fase 0–1, dt = incremento). */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Coefficiente di un filtro a un polo che raggiunge ~63% in `seconds`. */
export function onePole(seconds: number, sampleRate: number): number {
  return seconds <= 0 ? 1 : 1 - Math.exp(-1 / (seconds * sampleRate));
}

/** Lettura di un canale con avvolgimento delle voci (0 se il blocco manca). */
export function channel(block: { channels: Float32Array[] } | undefined, v: number): Float32Array | undefined {
  if (!block || block.channels.length === 0) return undefined;
  return block.channels[v % block.channels.length];
}
