/**
 * Snare displacement — sposta il backbeat: i colpi che cadono sul 2 e sul 4
 * (o solo su uno, o su tutti i beat) vengono anticipati o ritardati di un
 * sedicesimo o di un trentaduesimo, sempre o con probabilità. Serve la fase
 * (la battuta in 4/4).
 *
 * L'anticipo ha un tetto di 60 ms (MAX_EARLY): un colpo si può spostare
 * indietro solo dentro il lookahead. A 120 BPM un trentaduesimo (62.5 ms) ci
 * sta quasi, un sedicesimo in anticipo no: per quello si ritarda tutto il resto.
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import { phaseAt } from '../../../core/phase';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const SHIFTS = [-1 / 16, -1 / 32, 1 / 32, 1 / 16];
export const WHICH = ['2 e 4', '2', '4', 'tutti i beat'] as const;

/** Il colpo alla posizione p (in battute) cade su un beat scelto? */
export function onBackbeat(p: number, which: number, tol = 1 / 64): boolean {
  const beats = p * 4;
  const nearest = Math.round(beats);
  if (Math.abs(beats - nearest) > tol * 4) return false;
  const b = ((nearest % 4) + 4) % 4; // 0 = uno, 1 = due, …
  return which === 3 ? true : which === 1 ? b === 1 : which === 2 ? b === 3 : b === 1 || b === 3;
}

export const snareShift: ModuleDefinition = {
  manifest: {
    id: 'snareShift',
    name: 'Snare displacement',
    category: 'groove',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'which', label: 'Quali beat', min: 0, max: WHICH.length - 1, default: 0, kind: 'discrete', options: [...WHICH] },
      { id: 'shift', label: 'Spostamento', min: 0, max: 3, default: 3, kind: 'discrete', options: ['−1/16', '−1/32', '+1/32', '+1/16'] },
      { id: 'prob', label: 'Probabilità', min: 0, max: 1, default: 0.5, kind: 'continuous' },
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
        for (const e of input?.events ?? []) {
          if (!ph || !(speed > 0)) {
            out.events.push(e);
            continue;
          }
          const p = phaseAt(ph.start[0]!, ph.end[0]!, ctx.t0, ctx.t1, e.t);
          if (onBackbeat(p, ctx.discrete('which', ctx.tick)) && ctx.rng.chance(ctx.param('prob'))) {
            emitShifted(e, SHIFTS[ctx.discrete('shift', ctx.tick)]! / speed, ctx.t1, out.events, queue);
          } else out.events.push(e);
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

export default snareShift;
