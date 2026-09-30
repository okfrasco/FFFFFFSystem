/**
 * Densità — toglie o aggiunge eventi mantenendo quelli più forti.
 * Sotto 0.5 lascia passare solo i colpi con velocity sopra una soglia che
 * sale man mano (a 0 resta solo ciò che è pieno); sopra 0.5 aggiunge ghost
 * note a `offset` dopo ogni colpo, con probabilità crescente.
 */

import { EventQueue } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const density: ModuleDefinition = {
  manifest: {
    id: 'density',
    name: 'Densità',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'density', label: 'Densità', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'offset', label: 'Ghost dopo', min: 0.01, max: 0.5, default: 0.0625, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'ghost', label: 'Vel. ghost', min: 0.05, max: 1, default: 0.35, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const out = outputs.control('out', input?.values.length ?? 1);
        const d = ctx.param('density');
        for (const e of input?.events ?? []) {
          if (e.kind === 'gate') {
            out.events.push(e);
            continue;
          }
          const threshold = d < 0.5 ? (0.5 - d) * 2 : 0;
          if (e.vel < threshold) continue;
          out.events.push(e);
          if (d > 0.5 && ctx.rng.chance((d - 0.5) * 2)) {
            queue.push({ ...e, t: e.t + ctx.param('offset'), vel: e.vel * ctx.param('ghost') } as ControlEvent);
          }
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
      },
      getState: () => queue.getState(),
      setState(state) {
        queue.setState(state as ControlEvent[]);
      },
    };
  },
};

export default density;
