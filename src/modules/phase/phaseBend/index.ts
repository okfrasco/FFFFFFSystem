/**
 * Ø Bend — piega la fase dentro ogni ciclo: accelerando e rallentando senza
 * cambiare quanti step ci sono. La curva è sempre crescente e passa per
 * 0 e 1, quindi i confini del ciclo restano al loro posto e nessuno step si
 * perde o si ripete.
 *
 *   bend    f(u) = u^p, p = 4^amount: amount > 0 parte lento e accelera,
 *           amount < 0 parte veloce e rallenta
 *   pinch   f(u) = u − a·sin(2πu)/2π: amount > 0 stringe gli step verso metà
 *           ciclo, amount < 0 li allarga verso gli estremi
 *
 * La quantità si legge all'inizio di ogni ciclo (modulabile, ma per cicli):
 * cambiarla a metà farebbe saltare la fase e con lei gli step a valle.
 */

import type { ModuleDefinition } from '../../../core/types';

/** La curva di piegatura, u in [0, 1]. */
export function bendCurve(u: number, amount: number, mode: number): number {
  if (mode === 1) {
    const a = Math.max(-0.95, Math.min(0.95, amount));
    return u - (a * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);
  }
  return Math.pow(u, Math.pow(4, amount));
}

interface BendState {
  cycle: number[];
  amount: number[];
}

export const phaseBend: ModuleDefinition = {
  manifest: {
    id: 'phaseBend',
    name: 'Ø Bend',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [{ id: 'out', type: 'phase', poly: true }],
    params: [
      { id: 'amount', label: 'Quantità', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['bend', 'pinch'] },
    ],
    seeded: false,
  },
  create() {
    let s: BendState = { cycle: [], amount: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        for (let v = 0; v < n; v++) {
          const a = input.start[v]!;
          const b = input.end[v]!;
          const ca = Math.floor(a);
          const cb = Math.floor(b);
          if (s.cycle[v] !== ca) {
            s.cycle[v] = ca;
            s.amount[v] = ctx.param('amount', v);
          }
          const mode = ctx.discrete('mode', ca, v);
          out.start[v] = ca + bendCurve(a - ca, s.amount[v]!, mode);
          if (cb !== ca) {
            // il tick attraversa l'inizio di un ciclo: la quantità nuova vale da lì
            s.cycle[v] = cb;
            s.amount[v] = ctx.param('amount', v);
          }
          out.end[v] = cb + bendCurve(b - cb, s.amount[v]!, ctx.discrete('mode', cb, v));
        }
      },
      getState: () => ({ cycle: [...s.cycle], amount: [...s.amount] }),
      setState(state) {
        const st = state as BendState;
        s = { cycle: [...st.cycle], amount: [...st.amount] };
      },
    };
  },
};

export default phaseBend;
