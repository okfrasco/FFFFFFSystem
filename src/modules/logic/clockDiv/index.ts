/**
 * Clock Divide / Multiply — dal clock in ingresso: un trigger ogni `divide`
 * (con `offset` per scegliere quale), e `multiply` trigger distribuiti in
 * ogni intervallo, misurato tra gli ultimi due colpi in ingresso (i colpi
 * intermedi arrivano dopo quello reale, quindi a partire dal secondo colpo).
 */

import { EventQueue } from '../../../core/eventQueue';
import { eventsOf, isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

interface DivState {
  count: number;
  last: number;
  interval: number;
  queue: ControlEvent[];
}

export const clockDiv: ModuleDefinition = {
  manifest: {
    id: 'clockDiv',
    name: 'Clock Divide / Multiply',
    category: 'logic',
    rate: 'control',
    inputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'divide', label: 'Dividi', min: 1, max: 32, default: 2, kind: 'discrete' },
      { id: 'offset', label: 'Offset', min: 0, max: 31, default: 0, kind: 'discrete' },
      { id: 'multiply', label: 'Moltiplica', min: 1, max: 16, default: 1, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let s: DivState = { count: 0, last: NaN, interval: NaN, queue: [] };
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('trig');
        for (const e of eventsOf(inputs.control('trig'), 0).filter(isOn)) {
          if (Number.isFinite(s.last)) s.interval = e.t - s.last;
          s.last = e.t;
          const div = ctx.discrete('divide', s.count);
          const k = s.count++;
          if ((k - ctx.discrete('offset', k)) % div !== 0) continue;
          const vel = e.kind === 'gate' ? 1 : e.vel;
          queue.push({ kind: 'trig', t: e.t, voice: 0, vel });
          const mul = ctx.discrete('multiply', k);
          // gli intermedi coprono l'intervallo di `div` colpi, misurato sull'ultimo
          if (mul > 1 && Number.isFinite(s.interval)) {
            const span = s.interval * div;
            for (let j = 1; j < mul; j++) queue.push({ kind: 'trig', t: e.t + (span * j) / mul, voice: 0, vel: vel * 0.8 });
          }
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
        out.values[0] = 1;
      },
      getState: () => ({ ...s, queue: queue.getState() }),
      setState(state) {
        const st = state as DivState;
        s = { ...st };
        queue.setState(st.queue);
      },
    };
  },
};

export default clockDiv;
