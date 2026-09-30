/**
 * Funzioni per i moduli che leggono la fase: step attraversati in un tick
 * (con swing e fase al contrario) e clock a step per i generatori.
 */

import type { Inputs, ProcessContext } from './types';

export interface StepHit {
  /** Indice di step srotolato (può essere negativo con la fase al contrario). */
  step: number;
  /** Istante esatto in cui lo step inizia. */
  t: number;
}

/**
 * Step di una griglia di `steps` step per ciclo in cui la fase entra nel tick.
 *
 * Intervallo semiaperto: in avanti conta i confini in [start, end), all'indietro
 * in (end, start]. Così un confine che cade esattamente tra due tick scatta una
 * sola volta, e il primo tick del Transport (fase 0) fa suonare lo step 0.
 *
 * Swing in [-1, 1]: sposta gli step dispari di swing · mezzo step
 * (2/3 = swing in terzina 2:1, 1 = puntato 3:1, negativo = anticipo).
 */
export function stepCrossings(
  start: number,
  end: number,
  steps: number,
  t0: number,
  t1: number,
  swing = 0,
): StepHit[] {
  const hits: StepHit[] = [];
  if (!(steps > 0) || start === end) return hits;
  const s = start * steps;
  const e = end * steps;
  const shift = 0.5 * Math.max(-1, Math.min(1, swing));
  const target = (b: number): number => (isOdd(b) ? b + shift : b);
  const at = (x: number): number => t0 + ((x - s) / (e - s)) * (t1 - t0);
  if (e > s) {
    for (let b = Math.floor(s) - 1; b <= Math.ceil(e) + 1; b++) {
      const x = target(b);
      if (x >= s && x < e) hits.push({ step: b, t: at(x) });
    }
  } else {
    for (let b = Math.ceil(s) + 1; b >= Math.floor(e) - 1; b--) {
      const x = target(b);
      // all'indietro si passa il confine b entrando nello step b-1
      if (x <= s && x > e) hits.push({ step: b - 1, t: at(x) });
    }
  }
  return hits;
}

function isOdd(b: number): boolean {
  return (((b % 2) + 2) % 2) === 1;
}

/** Valore della fase all'istante t dentro il tick (lineare tra start ed end). */
export function phaseAt(start: number, end: number, t0: number, t1: number, t: number): number {
  if (t1 === t0) return end;
  return start + ((t - t0) / (t1 - t0)) * (end - start);
}

/** Modulo sempre positivo. */
export function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

export interface ClockHit {
  /** Chiave stabile dell'evento (step srotolato o contatore dei trigger). */
  key: number;
  t: number;
  vel: number;
}

/**
 * Clock dei generatori a step (Markov, L-system): se l'ingresso `trig` è
 * collegato avanza a ogni trigger, altrimenti legge la fase `phase` con il
 * parametro `steps` (step per ciclo) e lo swing standard.
 * `counter` tiene il conteggio dei trigger tra un tick e l'altro.
 */
export function clockHits(ctx: ProcessContext, inputs: Inputs, counter: { n: number }): ClockHit[] {
  const trig = inputs.control('trig');
  if (trig) {
    const hits: ClockHit[] = [];
    for (const e of trig.events) {
      if (e.kind === 'gate' && !e.on) continue;
      hits.push({ key: counter.n++, t: e.t, vel: e.kind === 'gate' ? 1 : e.vel });
    }
    return hits;
  }
  const ph = inputs.phase('phase');
  if (!ph) return [];
  const steps = ctx.discrete('steps', Math.floor(ph.start[0] ?? 0));
  return stepCrossings(ph.start[0] ?? 0, ph.end[0] ?? 0, steps, ctx.t0, ctx.t1, ctx.param('swing')).map((h) => ({
    key: h.step,
    t: h.t,
    vel: 1,
  }));
}
