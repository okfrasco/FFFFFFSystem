/**
 * Flam / Ghost — colpi in più attorno ai colpi principali:
 *   flam   un colpo di grazia poco prima (`flamTime`), più piano
 *   ghost  un colpo debole uno step dopo e/o prima (`ghostOffset`, in cicli
 *          con la fase collegata: 0.0625 = un sedicesimo di battuta; senza,
 *          in secondi)
 * ognuno con la sua probabilità. Il colpo principale passa sempre.
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const flamGhost: ModuleDefinition = {
  manifest: {
    id: 'flamGhost',
    name: 'Flam / Ghost',
    category: 'groove',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'flamProb', label: 'Flam', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'flamTime', label: 'Flam prima', min: 0.005, max: 0.05, default: 0.02, kind: 'continuous', unit: 's' },
      { id: 'flamVel', label: 'Vel. flam', min: 0.1, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'ghostProb', label: 'Ghost', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'ghostOffset', label: 'Ghost a', min: 0.01, max: 0.25, default: 0.0625, kind: 'continuous' },
      { id: 'ghostSide', label: 'Ghost dove', min: 0, max: 2, default: 0, kind: 'discrete', options: ['dopo', 'prima', 'entrambi'] },
      { id: 'ghostVel', label: 'Vel. ghost', min: 0.05, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const ph = inputs.phase('phase');
        const out = outputs.control('out', input?.values.length ?? 1);
        const speed = ph ? (ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const ghostDt = ph && speed > 0 ? ctx.param('ghostOffset') / speed : ctx.param('ghostOffset');
        for (const e of input?.events ?? []) {
          out.events.push(e);
          if (e.kind === 'gate') continue;
          const soft = (k: number) => ({ ...e, vel: Math.max(0.02, e.vel * k) }) as ControlEvent;
          if (ctx.rng.chance(ctx.param('flamProb'))) emitShifted(soft(ctx.param('flamVel')), -ctx.param('flamTime'), ctx.t1, out.events, queue);
          if (ctx.rng.chance(ctx.param('ghostProb'))) {
            const side = ctx.discrete('ghostSide', ctx.tick);
            if (side !== 1) emitShifted(soft(ctx.param('ghostVel')), ghostDt, ctx.t1, out.events, queue);
            if (side !== 0) emitShifted(soft(ctx.param('ghostVel')), -Math.min(ghostDt, 0.06), ctx.t1, out.events, queue);
          }
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

export default flamGhost;
