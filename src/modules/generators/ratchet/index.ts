/**
 * Ratchet — con probabilità `prob`, un colpo diventa `repeats` colpi
 * ravvicinati dentro il suo step. La durata dello step viene dalla fase
 * (`steps` step per ciclo) se è collegata, altrimenti dall'intervallo tra gli
 * ultimi due colpi. `decay` abbassa la velocity delle ripetizioni.
 */

import { EventQueue } from '../../../core/eventQueue';
import { eventsOf, isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

interface RatchetState {
  last: number;
  interval: number;
  queue: ControlEvent[];
}

export const ratchet: ModuleDefinition = {
  manifest: {
    id: 'ratchet',
    name: 'Ratchet',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'repeats', label: 'Ripetizioni', min: 2, max: 8, default: 3, kind: 'discrete' },
      { id: 'prob', label: 'Probabilità', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'decay', label: 'Decadimento', min: 0, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const queue = new EventQueue();
    let last = NaN;
    let interval = NaN;
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('trig');
        const ph = inputs.phase('phase');
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        for (const e of eventsOf(inputs.control('trig'), 0)) {
          if (!isOn(e)) {
            queue.push(e);
            continue;
          }
          if (Number.isFinite(last) && e.t > last) interval = e.t - last;
          last = e.t;
          queue.push(e);
          const stepDur = ph && speed > 0 ? 1 / (speed * ctx.discrete('steps', ctx.tick)) : interval;
          if (!(stepDur > 0) || !ctx.rng.chance(ctx.param('prob'))) continue;
          const n = ctx.discrete('repeats', ctx.tick);
          const vel = e.kind === 'gate' ? 1 : e.vel;
          for (let i = 1; i < n; i++) {
            const copy = { ...e, t: e.t + (i * stepDur) / n } as ControlEvent;
            if (copy.kind !== 'gate') copy.vel = Math.max(0.02, vel * Math.pow(1 - ctx.param('decay'), i));
            queue.push(copy);
          }
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
      },
      getState: (): RatchetState => ({ last, interval, queue: queue.getState() }),
      setState(state) {
        const st = state as RatchetState;
        last = st.last;
        interval = st.interval;
        queue.setState(st.queue);
      },
    };
  },
};

export default ratchet;
