/**
 * Scale / Offset / Invert — riscala, sposta e inverte un segnale di controllo:
 *   out = f(in) · scale + offset,  f = identità, 1 − x oppure −x.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export function scaleOffset(x: number, scale: number, offset: number, invert: number): number {
  const f = invert === 1 ? 1 - x : invert === 2 ? -x : x;
  return f * scale + offset;
}

export const scaleOffsetModule: ModuleDefinition = {
  manifest: {
    id: 'scaleOffset',
    name: 'Scale / Offset',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'scale', label: 'Scala', min: -4, max: 4, default: 1, kind: 'continuous' },
      { id: 'offset', label: 'Offset', min: -2, max: 2, default: 0, kind: 'continuous' },
      { id: 'invert', label: 'Inverti', min: 0, max: 2, default: 0, kind: 'discrete', options: ['no', '1 − x', '−x'] },
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
          const x = input ? readVoice(input.values, v) : 0;
          out.values[v] = scaleOffset(x, ctx.param('scale', v), ctx.param('offset', v), ctx.discrete('invert', ctx.tick, v));
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default scaleOffsetModule;
