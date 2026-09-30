/**
 * Setaccio — i sieve di Xenakis: una scrittura per insiemi di step.
 *
 *   m@r          gli step n con n mod m = r   (3@0 = 0, 3, 6, 9…)
 *   A | B        unione
 *   A & B        intersezione
 *   ~A           complemento
 *   ( … )        raggruppamento
 *
 * Es.: "(3@0 | 4@1) & ~5@2". Gli step sono `division` per ciclo della fase e
 * si contano dall'inizio (non si ripetono a ogni ciclo): il periodo è il
 * minimo comune multiplo dei moduli, anche lunghissimo con poche cifre.
 */

import { stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export type Sieve = (n: number) => boolean;

/** Traduce un'espressione in funzione; lancia un Error con la posizione se non è valida. */
export function parseSieve(src: string): Sieve {
  const s = src.replace(/\s+/g, '');
  let i = 0;
  const fail = (msg: string): never => {
    throw new Error(`${msg} (posizione ${i + 1})`);
  };
  const int = (): number => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) fail('serve un numero');
    i += m![0].length;
    return Number(m![0]);
  };
  const factor = (): Sieve => {
    if (s[i] === '~') {
      i++;
      const f = factor();
      return (n) => !f(n);
    }
    if (s[i] === '(') {
      i++;
      const e = expr();
      if (s[i] !== ')') fail('manca )');
      i++;
      return e;
    }
    const m = int();
    if (s[i] !== '@') fail('serve @ dopo il modulo');
    i++;
    const r = int();
    if (m === 0) fail('il modulo non può essere 0');
    return (n) => ((n % m) + m) % m === r % m;
  };
  const term = (): Sieve => {
    let f = factor();
    while (s[i] === '&') {
      i++;
      const g = factor();
      const a = f;
      f = (n) => a(n) && g(n);
    }
    return f;
  };
  const expr = (): Sieve => {
    let f = term();
    while (s[i] === '|') {
      i++;
      const g = term();
      const a = f;
      f = (n) => a(n) || g(n);
    }
    return f;
  };
  if (!s) return () => false;
  const out = expr();
  if (i < s.length) fail(`carattere inatteso "${s[i]}"`);
  return out;
}

export interface SieveConfig {
  expr: string;
}

export const sieve: ModuleDefinition = {
  manifest: {
    id: 'sieve',
    name: 'Setaccio',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'division', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'shift', label: 'Sposta', min: 0, max: 63, default: 0, kind: 'discrete' },
    ],
    seeded: false,
  },
  defaultConfig: { expr: '(3@0 | 4@1) & ~5@2' } satisfies SieveConfig,
  create(init) {
    let fn: Sieve = () => false;
    const load = (c: unknown) => {
      try {
        fn = parseSieve((c as SieveConfig).expr);
      } catch {
        fn = () => false; // espressione non valida: tace (il widget mostra l'errore)
      }
    };
    load(init.config);
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const out = outputs.control('trig');
        const div = ctx.discrete('division', Math.floor(ph.start[0]!));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, div, ctx.t0, ctx.t1)) {
          if (fn(hit.step + ctx.discrete('shift', hit.step))) out.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1, value: hit.step });
        }
      },
      setConfig: load,
      getState: () => null,
      setState() {},
    };
  },
};

export default sieve;
