/**
 * Swing continuo — swing sulla fase con una curva per coppia di step: ogni
 * coppia della battuta ha il suo swing (amount × il punto della curva,
 * −1…1), anche negativo. Così il primo beat può essere dritto e il terzo
 * molto swingato, o lo swing può "respirare" dentro la battuta.
 * La curva si disegna nel nodo; `division` sono gli step per ciclo (8 =
 * ottavi, 16 = sedicesimi, sulla battuta).
 */

import type { ModuleDefinition } from '../../../core/types';
import { swingWarp } from '../../phase/phaseSwing';

export interface GrooveSwingConfig {
  curve: number[];
}

interface SwState {
  pair: number[];
  amount: number[];
}

export const grooveSwing: ModuleDefinition = {
  manifest: {
    id: 'grooveSwing',
    name: 'Swing continuo',
    category: 'groove',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [{ id: 'out', type: 'phase', poly: true }],
    params: [
      { id: 'amount', label: 'Swing', min: -1, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'division', label: 'Step per ciclo', min: 2, max: 64, default: 16, kind: 'discrete' },
    ],
    seeded: false,
  },
  defaultConfig: { curve: [0.4, 1, 0.6, 1, 0.4, 1, 0.8, 0.2] } satisfies GrooveSwingConfig,
  create(init) {
    let curve = (init.config as GrooveSwingConfig).curve;
    let s: SwState = { pair: [], amount: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        for (let v = 0; v < n; v++) {
          const pairs = ctx.discrete('division', Math.floor(input.start[v]!), v) / 2;
          const warp = (x: number) => {
            const p = x * pairs;
            const k = Math.floor(p);
            if (s.pair[v] !== k) {
              s.pair[v] = k;
              const c = curve.length ? curve[((k % pairs) % curve.length + curve.length) % curve.length]! : 1;
              s.amount[v] = Math.max(-1, Math.min(1, ctx.param('amount', v) * c));
            }
            return (k + swingWarp(p - k, s.amount[v]!)) / pairs;
          };
          out.start[v] = warp(input.start[v]!);
          out.end[v] = warp(input.end[v]!);
        }
      },
      setConfig(c) {
        curve = (c as GrooveSwingConfig).curve;
      },
      getState: () => ({ pair: [...s.pair], amount: [...s.amount] }),
      setState(state) {
        const st = state as SwState;
        s = { pair: [...st.pair], amount: [...st.amount] };
      },
    };
  },
};

export default grooveSwing;
