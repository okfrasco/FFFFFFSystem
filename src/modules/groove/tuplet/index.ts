/**
 * Tupla — N colpi equidistanti dentro una durata `span` (in cicli della fase:
 * sulla battuta 0.25 = un beat, 0.5 = due beat): 5 contro 4, 7 contro 4,
 * 9 contro 8… con il suo swing e l'accento sul primo colpo della tupla.
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export const tuplet: ModuleDefinition = {
  manifest: {
    id: 'tuplet',
    name: 'Tupla',
    category: 'groove',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'n', label: 'Colpi', min: 2, max: 13, default: 5, kind: 'discrete' },
      { id: 'span', label: 'Durata', min: 0.0625, max: 1, default: 0.25, kind: 'continuous', curve: 'exp', unit: 'cicli' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'accent', label: 'Accento', min: 0, max: 1, default: 0.4, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const out = outputs.control('trig');
        const span = ctx.param('span');
        const n = ctx.discrete('n', Math.floor(ph.start[0]! / span));
        for (const hit of stepCrossings(ph.start[0]! / span, ph.end[0]! / span, n, ctx.t0, ctx.t1, ctx.param('swing'))) {
          const i = mod(hit.step, n);
          out.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: i === 0 ? 1 : 1 - ctx.param('accent'), value: i });
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default tuplet;
