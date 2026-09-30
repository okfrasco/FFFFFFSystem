/**
 * Coda di eventi futuri, per i moduli che spostano o ripetono eventi (Echo,
 * Humanize, Densità): un evento programmato oltre il tick corrente aspetta
 * qui e viene consegnato nel tick che lo contiene. La coda è serializzabile
 * (fa parte dello stato del modulo).
 */

import type { ControlEvent } from './types';
import { cloneJson } from './types';

export class EventQueue {
  private pending: ControlEvent[] = [];

  get size(): number {
    return this.pending.length;
  }

  push(e: ControlEvent): void {
    this.pending.push(e);
  }

  /** Sposta in `out` gli eventi con t < t1 (quelli già passati escono a t0), in ordine di tempo. */
  flush(t0: number, t1: number, out: ControlEvent[]): void {
    if (!this.pending.length) return;
    const due: ControlEvent[] = [];
    const later: ControlEvent[] = [];
    for (const e of this.pending) (e.t < t1 ? due : later).push(e);
    this.pending = later;
    for (const e of due) out.push(e.t < t0 ? { ...e, t: t0 } : e);
    out.sort((a, b) => a.t - b.t);
  }

  clear(): void {
    this.pending = [];
  }

  getState(): ControlEvent[] {
    return cloneJson(this.pending);
  }

  setState(state: ControlEvent[] | undefined): void {
    this.pending = cloneJson(state ?? []);
  }
}
