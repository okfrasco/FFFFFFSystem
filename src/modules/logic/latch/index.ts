/**
 * Latch — uno stato acceso/spento cambiato dai trigger: in modo "alterna"
 * ogni trigger lo inverte; in modo "fissa" un trigger lo accende e `reset` lo
 * spegne. Il gate in uscita cambia all'istante del trigger.
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const latch: ModuleDefinition = {
  manifest: {
    id: 'latch',
    name: 'Latch',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'reset', type: 'control', signal: 'event', poly: true },
    ],
    outputs: [{ id: 'gate', type: 'control', signal: 'gate', poly: true }],
    params: [{ id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['alterna', 'fissa'] }],
    seeded: false,
  },
  create() {
    let on: boolean[] = [];
    return {
      process(ctx, inputs, outputs) {
        const T = inputs.control('trig');
        const R = inputs.control('reset');
        const n = Math.max(T?.values.length ?? 1, R?.values.length ?? 1);
        const gate = outputs.control('gate', n);
        for (let v = 0; v < n; v++) {
          const evs: { t: number; reset: boolean }[] = [
            ...eventsOf(T, v).filter(isOn).map((e: ControlEvent) => ({ t: e.t, reset: false })),
            ...eventsOf(R, v).filter(isOn).map((e: ControlEvent) => ({ t: e.t, reset: true })),
          ].sort((a, b) => a.t - b.t);
          const toggle = ctx.discrete('mode', ctx.tick, v) === 0;
          for (const e of evs) {
            const next = e.reset ? false : toggle ? !on[v] : true;
            if (next !== !!on[v]) gate.events.push({ kind: 'gate', t: e.t, voice: v, on: next });
            on[v] = next;
          }
          gate.values[v] = on[v] ? 1 : 0;
        }
      },
      getState: () => [...on],
      setState(state) {
        on = [...(state as boolean[])];
      },
    };
  },
};

export default latch;
