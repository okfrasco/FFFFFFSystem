/**
 * Drift correlato — ogni colpo arriva un po' prima o un po' dopo, secondo una
 * deriva lenta e continua (non un caso per nota): colpi vicini si spostano
 * insieme, come un musicista che tira avanti e poi rallenta. `correlation`
 * lega le voci tra loro. Scarto fino a ±`amount` ms (l'anticipo fino a 60).
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';
import { smoothNoise } from '../../phase/phaseDrift';

export const correlatedDrift: ModuleDefinition = {
  manifest: {
    id: 'correlatedDrift',
    name: 'Drift correlato',
    category: 'groove',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', signal: 'event', poly: true }],
    outputs: [
      { id: 'out', type: 'control', signal: 'event', poly: true },
      { id: 'offset', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'amount', label: 'Scarto', min: 0, max: 60, default: 15, kind: 'continuous', unit: 'ms' },
      { id: 'rate', label: 'Velocità', min: 0.02, max: 4, default: 0.3, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'correlation', label: 'Correlazione', min: 0, max: 1, default: 0.7, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    const seed = init.seed;
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const out = outputs.control('out', input?.values.length ?? 1);
        const amount = ctx.param('amount') / 1000;
        const rate = ctx.param('rate');
        const corr = ctx.param('correlation');
        const drift = (t: number, voice: number) => amount * (corr * smoothNoise(seed, 0, t * rate) + (1 - corr) * smoothNoise(seed, voice + 1, t * rate));
        for (const e of input?.events ?? []) emitShifted(e, drift(e.t, e.voice), ctx.t1, out.events, queue);
        queue.flush(ctx.t0, ctx.t1, out.events);
        out.events.sort((x, y) => x.t - y.t);
        outputs.control('offset').values[0] = drift(ctx.t1, 0) * 1000;
      },
      getState: () => queue.getState(),
      setState(state) {
        queue.setState(state as ControlEvent[]);
      },
    };
  },
};

export default correlatedDrift;
