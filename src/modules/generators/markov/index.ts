/**
 * Markov — catena a matrice di transizione, con la matrice fatta di parametri:
 * ogni cella si modula con un cavo e si morpha con le scene.
 *
 * Fino a 12 stati (`size` attivi). Cella m{i}_{j} = peso della transizione
 * dallo stato i allo stato j. Ogni stato ha un valore v{i} (es. un grado di
 * scala per Quantize) e un'attrazione a{j}: moltiplica la colonna j, quindi
 * alzarla rende lo stato j più probabile da ovunque (0.5 = neutra, 0 = vietato).
 *
 * A ogni step del clock sceglie lo stato successivo e lo emette come trigger
 * con valore. Mutazione: mescola i pesi con la scelta uniforme.
 */

import { clockHits } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition, type ParamSpec } from '../../../core/types';

export const MARKOV_MAX_STATES = 12;

export const cellId = (i: number, j: number): string => `m${i}_${j}`;
export const valueId = (i: number): string => `v${i}`;
export const attractionId = (j: number): string => `a${j}`;

/** Matrice di default: passi brevi più probabili, ritorno a tonica e quinta. */
function defaultWeight(i: number, j: number): number {
  const d = Math.abs(i - j);
  const step = d === 0 ? 0.4 : d === 1 ? 3 : d === 2 ? 2 : d === 4 ? 1 : 0.25;
  return (step + (j === 0 || j === 4 ? 0.8 : 0)) / 3.8;
}

const params: ParamSpec[] = [
  { id: 'size', label: 'Stati', min: 2, max: MARKOV_MAX_STATES, default: 8, kind: 'discrete' },
  { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
  ...STANDARD_GENERATOR_PARAMS,
];
for (let i = 0; i < MARKOV_MAX_STATES; i++) {
  params.push({ id: valueId(i), label: `valore ${i}`, min: -24, max: 24, default: i, kind: 'continuous' });
}
for (let j = 0; j < MARKOV_MAX_STATES; j++) {
  params.push({ id: attractionId(j), label: `attrazione ${j}`, min: 0, max: 1, default: 0.5, kind: 'continuous' });
}
for (let i = 0; i < MARKOV_MAX_STATES; i++) {
  for (let j = 0; j < MARKOV_MAX_STATES; j++) {
    params.push({ id: cellId(i, j), label: `${i}→${j}`, min: 0, max: 1, default: +defaultWeight(i, j).toFixed(4), kind: 'continuous' });
  }
}

/** Parametri per una patch a partire da una matrice (righe = da, colonne = verso). */
export function markovParams(matrix: number[][], values?: number[]): Record<string, number> {
  const out: Record<string, number> = { size: matrix.length };
  for (let i = 0; i < MARKOV_MAX_STATES; i++) {
    for (let j = 0; j < MARKOV_MAX_STATES; j++) out[cellId(i, j)] = matrix[i]?.[j] ?? 0;
  }
  values?.forEach((v, i) => (out[valueId(i)] = v));
  return out;
}

interface MarkovState {
  current: number;
  counter: number;
}

export const markov: ModuleDefinition = {
  manifest: {
    id: 'markov',
    name: 'Markov',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
      { id: 'state', type: 'control', signal: 'value' },
    ],
    params,
    seeded: true,
  },

  create() {
    // la catena parte dal primo stato (la tonica nella matrice di default)
    let s: MarkovState = { current: 0, counter: 0 };
    const weights = new Array<number>(MARKOV_MAX_STATES).fill(0);

    return {
      process(ctx, inputs, outputs) {
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          const n = ctx.discrete('size', hit.key);
          const from = Math.min(s.current, n - 1);
          const m = ctx.param('mutation');
          let sum = 0;
          for (let j = 0; j < n; j++) {
            const a = ctx.param(attractionId(j));
            weights[j] = ctx.param(cellId(from, j)) * 4 * a * a;
            sum += weights[j]!;
          }
          for (let j = 0; j < n; j++) weights[j] = (1 - m) * (sum > 0 ? weights[j]! / sum : 1 / n) + m / n;
          const next = Math.max(0, ctx.rng.weighted(weights.slice(0, n)));
          s.current = next;
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: ctx.param(valueId(next)) });
        }
        const n = ctx.discrete('size', s.counter);
        trig.values[0] = 1;
        outputs.control('value').values[0] = ctx.param(valueId(s.current));
        outputs.control('state').values[0] = n > 1 ? s.current / (n - 1) : 0;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as MarkovState) };
      },
    };
  },
};

export default markov;
