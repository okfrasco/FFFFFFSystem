/** Mod Mixer — somma pesata di quattro modulazioni (pesi anche negativi) più un offset. */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition, ParamSpec } from '../../../core/types';

const params: ParamSpec[] = [];
for (let k = 1; k <= 4; k++) params.push({ id: `amt${k}`, label: `peso ${k}`, min: -1, max: 1, default: k === 1 ? 1 : 0, kind: 'continuous' });
params.push({ id: 'offset', label: 'Offset', min: -1, max: 1, default: 0, kind: 'continuous' });

export const modMixer: ModuleDefinition = {
  manifest: {
    id: 'modMixer',
    name: 'Mod Mixer',
    category: 'transform',
    rate: 'control',
    inputs: [1, 2, 3, 4].map((k) => ({ id: `in${k}`, type: 'control' as const, poly: true })),
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params,
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ins = [1, 2, 3, 4].map((k) => inputs.control(`in${k}`));
        const n = Math.max(1, ...ins.map((b) => b?.values.length ?? 1));
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          let sum = ctx.param('offset', v);
          ins.forEach((b, k) => {
            if (b) sum += ctx.param(`amt${k + 1}`, v) * readVoice(b.values, v);
          });
          out.values[v] = sum;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default modMixer;
