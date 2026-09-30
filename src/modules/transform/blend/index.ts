/** Blend — crossfade tra due segnali di controllo: mix 0 = A, 1 = B. */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export const blend: ModuleDefinition = {
  manifest: {
    id: 'blend',
    name: 'Blend',
    category: 'transform',
    rate: 'control',
    inputs: [
      { id: 'a', type: 'control', poly: true },
      { id: 'b', type: 'control', poly: true },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [{ id: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const a = inputs.control('a');
        const b = inputs.control('b');
        const n = Math.max(a?.values.length ?? 1, b?.values.length ?? 1);
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          const m = ctx.param('mix', v);
          out.values[v] = (a ? readVoice(a.values, v) : 0) * (1 - m) + (b ? readVoice(b.values, v) : 0) * m;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default blend;
