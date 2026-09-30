/** VCA — moltiplica il segnale per un controllo audio (es. un inviluppo) e per il guadagno. */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const vca: ModuleDefinition = {
  manifest: {
    id: 'vca',
    name: 'VCA',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'cv', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [{ id: 'gain', label: 'Guadagno', min: 0, max: 2, default: 1, kind: 'continuous' }],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const cv = inputs.audio('cv');
        const n = Math.max(input?.channels.length ?? 1, cv?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        const gain = ctx.param('gain');
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const c = channel(cv, v);
          const o = out[v]!;
          for (let i = 0; i < ctx.frames; i++) o[i] = (x ? x[i]! : 0) * (c ? c[i]! : 1) * gain;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default vca;
