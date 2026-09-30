/**
 * LFO aliasato — un triangolo campionato a step: a ogni step t il valore è
 *   raw = t · pattern / 100,  poi rimbalza tra 0 e 1 (su, giù, su…)
 * e resta fermo fino allo step successivo. Il campionamento è ciò che crea
 * l'aliasing: pattern vicini a divisori di 100 (25, 50) danno figure
 * ripetitive, i primi danno figure più caotiche.
 *
 * `length` fa ripartire t da 0 ogni N step (0 = mai), per legarlo alla size
 * di una Cadenza. La profondità verso il parametro modulato è l'amount del
 * cavo. `smooth` è la stessa onda senza campionamento.
 */

import { stepCrossings } from '../../core/phase';
import type { ModuleDefinition } from '../../core/types';

/** Valore dell'LFO aliasato allo step t (0–1). */
export function aliasedLfo(t: number, pattern: number): number {
  const raw = t * (pattern / 100);
  const cycle = Math.floor(raw);
  const f = raw - cycle;
  return cycle % 2 === 0 ? f : 1 - f;
}

interface LfoState {
  value: number;
}

export const aliasLfo: ModuleDefinition = {
  manifest: {
    id: 'aliasLfo',
    name: 'LFO aliasato',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'out', type: 'control', signal: 'value' },
      { id: 'smooth', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'pattern', label: 'Pattern', min: 0, max: 99, default: 50, kind: 'continuous' },
      { id: 'length', label: 'Reset (step)', min: 0, max: 64, default: 0, kind: 'discrete' },
      { id: 'division', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'polarity', label: 'Polarità', min: 0, max: 1, default: 0, kind: 'discrete', options: ['0…1', '−1…1'] },
    ],
    seeded: false,
  },

  create() {
    let s: LfoState = { value: 0 };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const a = ph.start[0]!;
        const b = ph.end[0]!;
        const division = ctx.discrete('division', Math.floor(a));
        const bip = ctx.discrete('polarity', Math.floor(a)) === 1;
        const shape = (x: number) => (bip ? x * 2 - 1 : x);
        for (const hit of stepCrossings(a, b, division, ctx.t0, ctx.t1)) {
          const len = ctx.discrete('length', hit.step);
          const t = len > 0 ? ((hit.step % len) + len) % len : hit.step;
          s.value = aliasedLfo(t, ctx.param('pattern'));
        }
        outputs.control('out').values[0] = shape(s.value);
        outputs.control('smooth').values[0] = shape(aliasedLfo(b * division, ctx.param('pattern')));
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as LfoState) };
      },
    };
  },
};
