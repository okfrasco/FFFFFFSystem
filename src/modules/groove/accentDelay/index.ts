/**
 * Accento → ritardo — lega il tempo alla velocity: i colpi forti cadono più
 * indietro (o più avanti, con `amount` negativo), quelli deboli dall'altra
 * parte, attorno a `pivot`. È il "peso" di chi suona: gli accenti che tirano.
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const accentDelay: ModuleDefinition = {
  manifest: {
    id: 'accentDelay',
    name: 'Accento → ritardo',
    category: 'groove',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'amount', label: 'Ms per velocity', min: -60, max: 60, default: 20, kind: 'continuous', unit: 'ms' },
      { id: 'pivot', label: 'Centro', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const out = outputs.control('out', input?.values.length ?? 1);
        for (const e of input?.events ?? []) {
          const vel = e.kind === 'gate' ? 1 : e.vel;
          emitShifted(e, ((vel - ctx.param('pivot')) * ctx.param('amount')) / 1000, ctx.t1, out.events, queue);
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
        out.events.sort((x, y) => x.t - y.t);
      },
      getState: () => queue.getState(),
      setState(state) {
        queue.setState(state as ControlEvent[]);
      },
    };
  },
};

export default accentDelay;
