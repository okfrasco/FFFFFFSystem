/**
 * Offset per voce — quattro corsie di eventi, ognuna con il suo anticipo o
 * ritardo in millisecondi: la cassa un po' avanti, il rullante dietro, gli
 * hat che corrono. L'anticipo arriva fino a 60 ms.
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition, ParamSpec } from '../../../core/types';

const LANES = 4;
const params: ParamSpec[] = [];
for (let k = 1; k <= LANES; k++) params.push({ id: `off${k}`, label: `offset ${k}`, min: -60, max: 60, default: 0, kind: 'continuous', unit: 'ms' });

export const voiceOffset: ModuleDefinition = {
  manifest: {
    id: 'voiceOffset',
    name: 'Offset per voce',
    category: 'groove',
    rate: 'control',
    inputs: Array.from({ length: LANES }, (_, k) => ({ id: `in${k + 1}`, type: 'control' as const, signal: 'event' as const, poly: true })),
    outputs: Array.from({ length: LANES }, (_, k) => ({ id: `out${k + 1}`, type: 'control' as const, signal: 'event' as const, poly: true })),
    params,
    seeded: false,
  },
  create() {
    const queues = Array.from({ length: LANES }, () => new EventQueue());
    return {
      process(ctx, inputs, outputs) {
        for (let k = 0; k < LANES; k++) {
          const input = inputs.control(`in${k + 1}`);
          const out = outputs.control(`out${k + 1}`, input?.values.length ?? 1);
          const dt = ctx.param(`off${k + 1}`) / 1000;
          for (const e of input?.events ?? []) emitShifted(e, dt, ctx.t1, out.events, queues[k]!);
          queues[k]!.flush(ctx.t0, ctx.t1, out.events);
          out.events.sort((a, b) => a.t - b.t);
        }
      },
      getState: () => queues.map((q) => q.getState()),
      setState(state) {
        (state as ControlEvent[][]).forEach((s, k) => queues[k]?.setState(s));
      },
    };
  },
};

export default voiceOffset;
