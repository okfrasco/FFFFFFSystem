/**
 * Sequenza numerica — serie di numeri come melodie o ritmi: Fibonacci,
 * primi, triangolari, quadrati, Collatz (i passi per arrivare a 1), o una
 * lista personalizzata. A ogni step esce seq(n) modulo `mod` (un grado, un
 * indice…). In modo "appartenenza" il trigger scatta solo se lo step n
 * appartiene alla serie: i primi o Fibonacci come ritmo.
 */

import { clockHits } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export const SEQUENCES = ['fibonacci', 'primi', 'triangolari', 'quadrati', 'collatz', 'personalizzata'] as const;

export interface NumberSeqConfig {
  values: number[];
}

const primes: number[] = [2];
/** Divisione per i primi fino alla radice (si ferma lì, non scorre tutta la lista). */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
function nthPrime(n: number): number {
  for (let c = primes[primes.length - 1]! + 1; primes.length <= n; c++) if (isPrime(c)) primes.push(c);
  return primes[n]!;
}

/** Fibonacci(n) mod m (raddoppio veloce, senza numeri enormi). */
function fibMod(n: number, m: number): number {
  const go = (k: number): [number, number] => {
    if (k === 0) return [0, 1];
    const [a, b] = go(Math.floor(k / 2));
    const c = (a * ((2 * b - a + m) % m)) % m;
    const d = (a * a + b * b) % m;
    return k % 2 === 0 ? [c, d] : [d, (c + d) % m];
  };
  return go(n)[0];
}

function isFib(n: number): boolean {
  let a = 0;
  let b = 1;
  while (a < n) [a, b] = [b, a + b];
  return a === n;
}

function collatz(n: number): number {
  let x = Math.max(1, n);
  let k = 0;
  while (x !== 1 && k < 1000) {
    x = x % 2 ? 3 * x + 1 : x / 2;
    k++;
  }
  return k;
}

/** Il termine n della serie, modulo m. */
export function seqValue(kind: number, n: number, m: number, custom: number[]): number {
  const mod = (x: number) => ((x % m) + m) % m;
  switch (kind) {
    case 0:
      return fibMod(n, m);
    case 1:
      return mod(nthPrime(n));
    case 2:
      return mod((n * (n + 1)) / 2);
    case 3:
      return mod(n * n);
    case 4:
      return mod(collatz(n + 1));
    default:
      return custom.length ? mod(custom[n % custom.length]!) : 0;
  }
}

/** Lo step n appartiene alla serie? (Collatz e lista: sempre.) */
export function seqMember(kind: number, n: number): boolean {
  switch (kind) {
    case 0:
      return isFib(n);
    case 1:
      return isPrime(n);
    case 2: {
      const k = Math.floor((Math.sqrt(8 * n + 1) - 1) / 2);
      return (k * (k + 1)) / 2 === n;
    }
    case 3:
      return Math.round(Math.sqrt(n)) ** 2 === n;
    default:
      return true;
  }
}

export const numberSeq: ModuleDefinition = {
  manifest: {
    id: 'numberSeq',
    name: 'Sequenza numerica',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'sequence', label: 'Serie', min: 0, max: SEQUENCES.length - 1, default: 0, kind: 'discrete', options: [...SEQUENCES] },
      { id: 'mod', label: 'Modulo', min: 1, max: 48, default: 8, kind: 'discrete' },
      { id: 'rhythm', label: 'Ritmo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['ogni step', 'appartenenza'] },
      { id: 'offset', label: 'Inizio', min: 0, max: 255, default: 0, kind: 'discrete' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: { values: [0, 4, 7, 2, 9, 5] } satisfies NumberSeqConfig,
  create(init) {
    let custom = (init.config as NumberSeqConfig).values;
    let counter = 0;
    let current = 0;
    return {
      process(ctx, inputs, outputs) {
        const c = { n: counter };
        const hits = clockHits(ctx, inputs, c);
        counter = c.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          const n = Math.max(0, hit.key) + ctx.discrete('offset', hit.key);
          const kind = ctx.discrete('sequence', hit.key);
          if (ctx.discrete('rhythm', hit.key) === 1 && !seqMember(kind, n)) continue;
          current = seqValue(kind, n, ctx.discrete('mod', hit.key), custom);
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: current });
        }
        outputs.control('value').values[0] = current;
        trig.values[0] = 1;
      },
      setConfig(config) {
        custom = (config as NumberSeqConfig).values;
      },
      getState: () => ({ counter, current }),
      setState(state) {
        const st = state as { counter: number; current: number };
        counter = st.counter;
        current = st.current;
      },
    };
  },
};

export default numberSeq;
