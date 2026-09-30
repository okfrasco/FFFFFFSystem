/**
 * Counter — conta i trigger e scatta alla soglia: al colpo numero
 * `threshold` esce un trigger e il conteggio riparte (o si ferma, in modo
 * "una volta", fino al reset). `count` è il conteggio come valore 0–1.
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

interface CountState {
  count: number;
  done: boolean;
}

export const counter: ModuleDefinition = {
  manifest: {
    id: 'counter',
    name: 'Counter',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'reset', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'count', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'threshold', label: 'Soglia', min: 1, max: 64, default: 4, kind: 'discrete' },
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['ciclo', 'una volta'] },
    ],
    seeded: false,
  },
  create() {
    let s: CountState = { count: 0, done: false };
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('trig');
        const evs = [
          ...eventsOf(inputs.control('trig'), 0).filter(isOn).map((e) => ({ t: e.t, reset: false })),
          ...eventsOf(inputs.control('reset'), 0).filter(isOn).map((e) => ({ t: e.t, reset: true })),
        ].sort((a, b) => a.t - b.t);
        const N = ctx.discrete('threshold', ctx.tick);
        for (const e of evs) {
          if (e.reset) {
            s = { count: 0, done: false };
            continue;
          }
          if (s.done) continue;
          s.count++;
          if (s.count >= N) {
            out.events.push({ kind: 'trig', t: e.t, voice: 0, vel: 1, value: s.count });
            s.count = 0;
            if (ctx.discrete('mode', ctx.tick) === 1) s.done = true;
          }
        }
        outputs.control('count').values[0] = s.count / N;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as CountState) };
      },
    };
  },
};

export default counter;
