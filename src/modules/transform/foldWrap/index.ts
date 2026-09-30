/**
 * Fold / Wrap — tiene un segnale tra `lo` e `hi`: ripiegandolo (rimbalza sui
 * bordi), avvolgendolo (rientra dall'altra parte) o tagliandolo.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export function foldWrap(x: number, lo: number, hi: number, mode: number): number {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const r = b - a;
  if (r < 1e-9) return a;
  if (mode === 2) return Math.max(a, Math.min(b, x));
  const u = (x - a) / r;
  if (mode === 1) return a + (u - Math.floor(u)) * r;
  const p = u - 2 * Math.floor(u / 2); // 0..2
  return a + (p <= 1 ? p : 2 - p) * r;
}

export const foldWrapModule: ModuleDefinition = {
  manifest: {
    id: 'foldWrap',
    name: 'Fold / Wrap',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['ripiega', 'avvolgi', 'taglia'] },
      { id: 'lo', label: 'Minimo', min: -2, max: 2, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: -2, max: 2, default: 1, kind: 'continuous' },
      { id: 'gain', label: 'Guadagno', min: 0, max: 8, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const n = input?.values.length ?? 1;
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          const x = (input ? readVoice(input.values, v) : 0) * ctx.param('gain', v);
          out.values[v] = foldWrap(x, ctx.param('lo', v), ctx.param('hi', v), ctx.discrete('mode', ctx.tick, v));
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default foldWrapModule;
