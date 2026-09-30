/**
 * N-Latch — cicla tra N stati, uno a ogni trigger (in avanti, a caso o
 * avanti e indietro); `reset` torna al primo. Uscite: lo stato come valore
 * (0–1), un trigger con l'indice, e N gate (uscita poly: la voce i è alta
 * quando lo stato è i).
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

interface NState {
  index: number;
  dir: number;
}

export const nLatch: ModuleDefinition = {
  manifest: {
    id: 'nLatch',
    name: 'N-Latch',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'reset', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'value', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'gates', type: 'control', signal: 'gate', poly: true },
    ],
    params: [
      { id: 'states', label: 'Stati', min: 2, max: 16, default: 4, kind: 'discrete' },
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['avanti', 'caso', 'avanti e indietro'] },
    ],
    seeded: true,
  },
  create() {
    let s: NState = { index: 0, dir: 1 };
    return {
      process(ctx, inputs, outputs) {
        const N = ctx.discrete('states', ctx.tick);
        const gates = outputs.control('gates', N);
        const trig = outputs.control('trig');
        const evs = [
          ...eventsOf(inputs.control('trig'), 0).filter(isOn).map((e) => ({ t: e.t, reset: false })),
          ...eventsOf(inputs.control('reset'), 0).filter(isOn).map((e) => ({ t: e.t, reset: true })),
        ].sort((a, b) => a.t - b.t);
        for (const e of evs) {
          const prev = s.index;
          if (e.reset) s.index = 0;
          else {
            const mode = ctx.discrete('mode', ctx.tick);
            if (mode === 1) s.index = (s.index + 1 + ctx.rng.int(0, N - 1)) % N;
            else if (mode === 2) {
              if (s.index + s.dir < 0 || s.index + s.dir >= N) s.dir = -s.dir;
              s.index += s.dir;
            } else s.index = (s.index + 1) % N;
          }
          s.index = Math.min(s.index, N - 1);
          trig.events.push({ kind: 'trig', t: e.t, voice: 0, vel: 1, value: s.index });
          if (prev !== s.index && prev < N) gates.events.push({ kind: 'gate', t: e.t, voice: prev, on: false });
          if (prev !== s.index) gates.events.push({ kind: 'gate', t: e.t, voice: s.index, on: true });
        }
        s.index = Math.min(s.index, N - 1);
        for (let i = 0; i < N; i++) gates.values[i] = i === s.index ? 1 : 0;
        outputs.control('value').values[0] = N > 1 ? s.index / (N - 1) : 0;
        trig.values[0] = 1;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as NState) };
      },
    };
  },
};

export default nLatch;
