/**
 * Burst — da un solo trigger una raffica di `count` colpi. L'intervallo di
 * partenza è `rate` (secondi, o cicli se la fase è collegata); `accel` lo
 * accorcia (pallina che rimbalza, > 0) o lo allunga (< 0) a ogni colpo;
 * `decay` fa calare la velocity. Ogni colpo porta il suo numero come valore.
 */

import { EventQueue } from '../../../core/eventQueue';
import { eventsOf, isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

/** Istanti (relativi) dei colpi di una raffica. */
export function burstTimes(count: number, interval: number, accel: number): number[] {
  const out: number[] = [];
  let t = 0;
  let d = interval;
  const k = Math.pow(2, -accel); // accel 1: ogni intervallo è metà del precedente
  for (let i = 0; i < count; i++) {
    out.push(t);
    t += d;
    d *= k;
  }
  return out;
}

export const burst: ModuleDefinition = {
  manifest: {
    id: 'burst',
    name: 'Burst',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'count', label: 'Colpi', min: 1, max: 32, default: 6, kind: 'discrete' },
      { id: 'rate', label: 'Intervallo', min: 0.005, max: 1, default: 0.08, kind: 'continuous', curve: 'exp' },
      { id: 'accel', label: 'Accelerazione', min: -1, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'decay', label: 'Decadimento', min: 0, max: 1, default: 0.15, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('trig');
        const ph = inputs.phase('phase');
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const interval = ph ? (speed > 0 ? ctx.param('rate') / speed : 0) : ctx.param('rate');
        for (const e of eventsOf(inputs.control('trig'), 0).filter(isOn)) {
          if (!(interval > 0)) continue;
          const vel0 = e.kind === 'gate' ? 1 : e.vel;
          burstTimes(ctx.discrete('count', ctx.tick), interval, ctx.param('accel')).forEach((dt, i) =>
            queue.push({ kind: 'trig', t: e.t + dt, voice: 0, vel: Math.max(0.02, vel0 * Math.pow(1 - ctx.param('decay'), i)), value: i }),
          );
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

export default burst;
