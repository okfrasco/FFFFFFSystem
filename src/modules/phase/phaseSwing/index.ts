/**
 * Ø Swing — swing sulla fase: ogni coppia di step (a `division` step per
 * ciclo) viene piegata così che il secondo step arrivi più tardi (o prima).
 * Tutto ciò che legge questa fase suona con lo stesso swing.
 *
 * amount in [−1, 1]: il secondo step della coppia si sposta di amount · mezzo
 * step (2/3 = terzina, 1 = puntato 3:1), come lo swing interno di Clock ed
 * Euclideo, ma per ogni nodo a valle. La quantità si legge a ogni coppia.
 *
 * Precisione: dentro un tick la fase è trattata come lineare, e la piegatura
 * ha un angolo proprio sugli step; chi legge questa fase li colloca entro
 * ~1 ms dall'istante esatto (1.25 ms al massimo, con swing 1). Lo swing
 * interno di Clock ed Euclideo invece è esatto.
 */

import type { ModuleDefinition } from '../../../core/types';

/** Posizione nella coppia (0–1) piegata: il punto di metà si sposta a m = 0.5 + amount/4. */
export function swingWarp(u: number, amount: number): number {
  const m = 0.5 + 0.25 * Math.max(-1, Math.min(1, amount));
  return u < m ? (0.5 * u) / m : 0.5 + (0.5 * (u - m)) / (1 - m);
}

interface SwingState {
  pair: number[];
  amount: number[];
}

export const phaseSwing: ModuleDefinition = {
  manifest: {
    id: 'phaseSwing',
    name: 'Ø Swing',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [{ id: 'out', type: 'phase', poly: true }],
    params: [
      { id: 'amount', label: 'Swing', min: -1, max: 1, default: 0.33, kind: 'continuous' },
      { id: 'division', label: 'Step per ciclo', min: 2, max: 64, default: 8, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let s: SwingState = { pair: [], amount: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        for (let v = 0; v < n; v++) {
          const div = ctx.discrete('division', Math.floor(input.start[v]!), v);
          const pairs = div / 2; // coppie per ciclo
          const warp = (x: number): number => {
            const p = x * pairs;
            const k = Math.floor(p);
            if (s.pair[v] !== k) {
              s.pair[v] = k;
              s.amount[v] = ctx.param('amount', v);
            }
            return (k + swingWarp(p - k, s.amount[v]!)) / pairs;
          };
          out.start[v] = warp(input.start[v]!);
          out.end[v] = warp(input.end[v]!);
        }
      },
      getState: () => ({ pair: [...s.pair], amount: [...s.amount] }),
      setState(state) {
        const st = state as SwingState;
        s = { pair: [...st.pair], amount: [...st.amount] };
      },
    };
  },
};

export default phaseSwing;
