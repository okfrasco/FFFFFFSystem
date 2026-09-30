/**
 * Comparatore — un gate quando A supera, eguaglia o è diverso da B
 * (= ≠ > < ≥ ≤). B è il parametro se l'ingresso non è collegato; `tol` è la
 * tolleranza per = e ≠. L'istante in cui cambia si stima interpolando tra
 * l'inizio e la fine del tick.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export const COMPARE_OPS = ['=', '≠', '>', '<', '≥', '≤'] as const;

export function compare(op: number, a: number, b: number, tol: number): boolean {
  switch (op) {
    case 0:
      return Math.abs(a - b) <= tol;
    case 1:
      return Math.abs(a - b) > tol;
    case 2:
      return a > b;
    case 3:
      return a < b;
    case 4:
      return a >= b;
    default:
      return a <= b;
  }
}

interface CmpState {
  diff: number[];
  out: boolean[];
}

export const compareModule: ModuleDefinition = {
  manifest: {
    id: 'compare',
    name: 'Comparatore',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'a', type: 'control', poly: true },
      { id: 'b', type: 'control', poly: true },
    ],
    outputs: [
      { id: 'gate', type: 'control', signal: 'gate', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'op', label: 'Confronto', min: 0, max: COMPARE_OPS.length - 1, default: 2, kind: 'discrete', options: [...COMPARE_OPS] },
      { id: 'b', label: 'B', min: -1, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'tol', label: 'Tolleranza', min: 0, max: 0.5, default: 0.02, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: CmpState = { diff: [], out: [] };
    return {
      process(ctx, inputs, outputs) {
        const A = inputs.control('a');
        const B = inputs.control('b');
        const n = Math.max(A?.values.length ?? 1, B?.values.length ?? 1);
        const gate = outputs.control('gate', n);
        const trig = outputs.control('trig', n);
        for (let v = 0; v < n; v++) {
          const a = A ? readVoice(A.values, v) : 0;
          const b = B ? readVoice(B.values, v) : ctx.param('b', v);
          const d = a - b;
          const out = compare(ctx.discrete('op', ctx.tick, v), a, b, ctx.param('tol', v));
          if (s.out[v] !== undefined && out !== s.out[v]) {
            // istante del passaggio: interpolazione della differenza nel tick
            const d0 = s.diff[v] ?? d;
            const k = d0 !== d ? Math.max(0, Math.min(1, d0 / (d0 - d))) : 0.5;
            const t = ctx.t0 + k * (ctx.t1 - ctx.t0);
            gate.events.push({ kind: 'gate', t, voice: v, on: out });
            if (out) trig.events.push({ kind: 'trig', t, voice: v, vel: 1 });
          }
          s.diff[v] = d;
          s.out[v] = out;
          gate.values[v] = out ? 1 : 0;
          trig.values[v] = out ? 1 : 0;
        }
      },
      getState: () => ({ diff: [...s.diff], out: [...s.out] }),
      setState(state) {
        const st = state as CmpState;
        s = { diff: [...st.diff], out: [...st.out] };
      },
    };
  },
};

export default compareModule;
