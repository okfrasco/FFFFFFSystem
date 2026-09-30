/**
 * Accoppiamento — le voci di una fase poly si ascoltano a vicenda (modello di
 * Kuramoto). Con `coupling` a 0 ogni voce segue il proprio ingresso; alzandolo
 * le fasi si attraggono fino a fondersi (canone → unisono, poliritmo → aggancio).
 * `tether` le richiama verso il proprio ingresso, quindi l'equilibrio tra i due
 * dà sincronie parziali che respirano.
 *
 * Ogni voce i ha uno scarto δ_i rispetto al proprio ingresso:
 *   dδ_i/dt = K · (1/N) Σ_j sin 2π(θ_j − θ_i) − T · δ_i,   θ_i = ingresso_i + δ_i
 * K e T sono proporzionali alla velocità media delle fasi, così il
 * comportamento non cambia con il tempo del brano.
 * `sync` è il parametro d'ordine r ∈ [0, 1]: quanto le fasi sono allineate.
 */

import type { ModuleDefinition } from '../../../core/types';

interface CouplingState {
  delta: number[];
}

const TAU = 2 * Math.PI;

export const coupling: ModuleDefinition = {
  manifest: {
    id: 'coupling',
    name: 'Accoppiamento',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [
      { id: 'out', type: 'phase', poly: true },
      { id: 'sync', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'coupling', label: 'Accoppiamento', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'tether', label: 'Richiamo', min: 0, max: 1, default: 0.1, kind: 'continuous' },
    ],
    seeded: true,
  },

  create() {
    let s: CouplingState = { delta: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        if (s.delta.length !== n) {
          // piccolo scarto iniziale: la distribuzione perfettamente uniforme
          // è un equilibrio instabile che altrimenti non si muoverebbe mai
          s.delta = Array.from({ length: n }, () => ctx.rng.range(-0.001, 0.001));
        }
        const dt = ctx.dt;
        let speed = 0;
        for (let v = 0; v < n; v++) speed += Math.abs(input.end[v]! - input.start[v]!) / n;
        const rate = dt > 0 ? speed / dt : 0; // cicli al secondo, in media
        const K = ctx.param('coupling') * 2 * rate;
        const T = ctx.param('tether') * 2 * rate;
        const theta = new Array<number>(n);
        for (let v = 0; v < n; v++) theta[v] = input.start[v]! + s.delta[v]!;
        let re = 0;
        let im = 0;
        for (let i = 0; i < n; i++) {
          let pull = 0;
          for (let j = 0; j < n; j++) pull += Math.sin(TAU * (theta[j]! - theta[i]!));
          const d0 = s.delta[i]!;
          const d1 = d0 + (K * (pull / n) - T * d0) * dt;
          out.start[i] = input.start[i]! + d0;
          out.end[i] = input.end[i]! + d1;
          s.delta[i] = d1;
          re += Math.cos(TAU * out.end[i]!);
          im += Math.sin(TAU * out.end[i]!);
        }
        outputs.control('sync').values[0] = Math.hypot(re, im) / n;
      },
      getState: () => ({ delta: [...s.delta] }),
      setState(state) {
        s = { delta: [...(state as CouplingState).delta] };
      },
    };
  },
};

export default coupling;
