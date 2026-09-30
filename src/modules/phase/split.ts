/**
 * Ø Split — una fase in N voci sfasate. La voce i è in ritardo di
 * i · spread / N cicli: con spread 1 le voci si distribuiscono sul ciclo,
 * con spread piccolo diventano echi ravvicinati dello stesso pattern.
 */

import type { ModuleDefinition } from '../../core/types';

export const phaseSplit: ModuleDefinition = {
  manifest: {
    id: 'phaseSplit',
    name: 'Ø Split',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase' }],
    outputs: [{ id: 'out', type: 'phase', poly: true }],
    params: [
      { id: 'count', label: 'Voci', min: 1, max: 16, default: 4, kind: 'discrete' },
      { id: 'spread', label: 'Spread', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const a = input.start[0]!;
        const b = input.end[0]!;
        const n = ctx.discrete('count', Math.floor(a));
        const out = outputs.phase('out', n);
        for (let v = 0; v < n; v++) {
          const off = (v * ctx.param('spread', v)) / n;
          out.start[v] = a - off;
          out.end[v] = b - off;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};
