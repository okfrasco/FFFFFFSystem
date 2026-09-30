/**
 * Echo — ripete gli eventi: ogni colpo torna `repeats` volte, a distanza
 * `time`, con la velocity che cala di `decay` a ogni ripetizione (e, per le
 * note, trasposto di `transpose` semitoni a ogni giro: echi che salgono o
 * scendono). Con la fase collegata `time` è in cicli (0.1875 = 3/16 di
 * battuta), quindi a tempo; senza, in secondi.
 */

import { EventQueue } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const echo: ModuleDefinition = {
  manifest: {
    id: 'echo',
    name: 'Echo',
    category: 'transform',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'time', label: 'Tempo', min: 0.01, max: 2, default: 0.1875, kind: 'continuous', curve: 'exp' },
      { id: 'repeats', label: 'Ripetizioni', min: 1, max: 16, default: 3, kind: 'discrete' },
      { id: 'decay', label: 'Decadimento', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -12, max: 12, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'dry', label: 'Originale', min: 0, max: 1, default: 1, kind: 'discrete', options: ['no', 'sì'] },
    ],
    seeded: false,
  },
  create() {
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const ph = inputs.phase('phase');
        const out = outputs.control('out', input?.values.length ?? 1);
        // con la fase: tempo in cicli, convertito in secondi con la velocità della fase
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const time = ph ? (speed > 0 ? ctx.param('time') / speed : 0) : ctx.param('time');
        for (const e of input?.events ?? []) {
          if (ctx.discrete('dry', ctx.tick) === 1) out.events.push(e);
          if (e.kind === 'gate' || !(time > 0)) continue;
          const reps = ctx.discrete('repeats', ctx.tick);
          const decay = ctx.param('decay');
          const tr = ctx.discrete('transpose', ctx.tick);
          let vel = e.vel;
          for (let k = 1; k <= reps; k++) {
            vel *= decay;
            if (vel < 0.01) break;
            const copy: ControlEvent = e.kind === 'note' ? { ...e, t: e.t + k * time, vel, pitch: e.pitch + k * tr } : { ...e, t: e.t + k * time, vel };
            queue.push(copy);
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

export default echo;
