/**
 * Clock Quantize — trattiene un trigger fino al prossimo colpo del clock, e
 * lo lascia uscire lì (con la sua velocity e il suo valore). Più trigger
 * nello stesso intervallo ne danno uno solo (l'ultimo).
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ModuleDefinition, TrigEvent } from '../../../core/types';

export const clockQuantize: ModuleDefinition = {
  manifest: {
    id: 'clockQuantize',
    name: 'Clock Quantize',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event' },
      { id: 'clock', type: 'control', signal: 'event' },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [],
    seeded: false,
  },
  create() {
    let held: TrigEvent | null = null;
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('trig');
        const items = [
          ...eventsOf(inputs.control('in'), 0).filter(isOn).map((e) => ({ t: e.t, clock: false, e })),
          ...eventsOf(inputs.control('clock'), 0).filter(isOn).map((e) => ({ t: e.t, clock: true, e })),
        ].sort((a, b) => a.t - b.t || (a.clock ? 1 : -1)); // a pari tempo il colpo in ingresso entra prima
        for (const it of items) {
          if (!it.clock) {
            const e = it.e;
            held = { kind: 'trig', t: e.t, voice: 0, vel: e.kind === 'gate' ? 1 : e.vel };
            const value = e.kind === 'trig' ? e.value : e.kind === 'note' ? e.pitch : undefined;
            if (value !== undefined) held.value = value;
          } else if (held) {
            out.events.push({ ...held, t: it.t });
            held = null;
          }
        }
        out.values[0] = held ? 1 : 0;
        void ctx;
      },
      getState: () => held,
      setState(state) {
        held = state as TrigEvent | null;
      },
    };
  },
};

export default clockQuantize;
