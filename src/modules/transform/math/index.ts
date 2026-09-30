/**
 * Math — combina due segnali di controllo voce per voce: somma, differenza,
 * prodotto, minimo, massimo, media. Se `b` non è collegato vale il parametro B.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export const MATH_OPS = ['somma', 'differenza', 'prodotto', 'min', 'max', 'media'] as const;

export function mathOp(op: number, a: number, b: number): number {
  switch (op) {
    case 0:
      return a + b;
    case 1:
      return a - b;
    case 2:
      return a * b;
    case 3:
      return Math.min(a, b);
    case 4:
      return Math.max(a, b);
    default:
      return (a + b) / 2;
  }
}

export const math: ModuleDefinition = {
  manifest: {
    id: 'math',
    name: 'Math',
    category: 'transform',
    rate: 'control',
    inputs: [
      { id: 'a', type: 'control', poly: true },
      { id: 'b', type: 'control', poly: true },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'op', label: 'Operazione', min: 0, max: MATH_OPS.length - 1, default: 0, kind: 'discrete', options: [...MATH_OPS] },
      { id: 'b', label: 'B', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const a = inputs.control('a');
        const b = inputs.control('b');
        const n = Math.max(a?.values.length ?? 1, b?.values.length ?? 1);
        const out = outputs.control('out', n);
        const op = ctx.discrete('op', ctx.tick);
        for (let v = 0; v < n; v++) {
          const x = a ? readVoice(a.values, v) : 0;
          const y = b ? readVoice(b.values, v) : ctx.param('b', v);
          out.values[v] = mathOp(op, x, y);
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default math;
