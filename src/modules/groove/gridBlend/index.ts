/**
 * Grid Blend — sposta gli eventi tra due griglie: ogni colpo viene portato
 * dalla sua posizione sulla griglia A verso il punto più vicino della griglia
 * B, di `blend` (0 = A, 1 = B). Con A = 16 e B = 24 per battuta i sedicesimi
 * dritti scivolano verso le terzine; con B = 20 verso le quintine. Il
 * microtiming proprio di ogni colpo si conserva. Serve la fase (la battuta).
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import { phaseAt } from '../../../core/phase';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

/** Spostamento (in cicli) di un colpo alla posizione p, da A verso B. */
export function gridShift(p: number, a: number, b: number, blend: number): number {
  const pa = Math.round(p * a) / a;
  const pb = Math.round(p * b) / b;
  return (pb - pa) * blend;
}

export const gridBlend: ModuleDefinition = {
  manifest: {
    id: 'gridBlend',
    name: 'Grid Blend',
    category: 'groove',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'a', label: 'Griglia A', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'b', label: 'Griglia B', min: 1, max: 64, default: 24, kind: 'discrete' },
      { id: 'blend', label: 'Miscela', min: 0, max: 1, default: 0.5, kind: 'continuous' },
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
        const speed = ph ? (ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        for (const e of input?.events ?? []) {
          if (!ph || !(speed > 0)) {
            out.events.push(e);
            continue;
          }
          const p = phaseAt(ph.start[0]!, ph.end[0]!, ctx.t0, ctx.t1, e.t);
          const dCycles = gridShift(p, ctx.discrete('a', ctx.tick), ctx.discrete('b', ctx.tick), ctx.param('blend'));
          emitShifted(e, dCycles / speed, ctx.t1, out.events, queue);
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

export default gridBlend;
