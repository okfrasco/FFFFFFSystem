/**
 * Mappa logistica — x ← r·x·(1 − x) a ogni step: con r sotto 3 si ferma su un
 * valore, poi raddoppia (2, 4, 8 valori che si alternano), e oltre ~3.57
 * diventa caotica, con finestre di ordine (3.83: periodo 3). Da stabile a
 * caotico con un solo parametro. Il valore esce come valore e sul trigger.
 */

import { clockHits } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export const logisticStep = (x: number, r: number): number => r * x * (1 - x);

interface LogState {
  x: number;
  history: number[];
  counter: number;
}

export const logistic: ModuleDefinition = {
  manifest: {
    id: 'logistic',
    name: 'Mappa logistica',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'r', label: 'r', min: 2.5, max: 4, default: 3.7, kind: 'continuous' },
      { id: 'x0', label: 'Inizio', min: 0.01, max: 0.99, default: 0.4, kind: 'continuous' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: LogState | null = null;
    return {
      process(ctx, inputs, outputs) {
        s ??= { x: ctx.param('x0'), history: [], counter: 0 };
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          s.x = logisticStep(s.x, ctx.param('r'));
          // bloccata su 0 (o fuori): riparte dall'inizio
          if (!(s.x > 1e-9 && s.x < 1)) s.x = ctx.param('x0');
          s.history = [...s.history, s.x].slice(-32);
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: s.x });
        }
        outputs.control('out').values[0] = s.x;
        trig.values[0] = 1;
      },
      getState: () => (s ? { ...s, history: [...s.history] } : null),
      setState(state) {
        const st = state as LogState | null;
        s = st ? { ...st, history: [...st.history] } : null;
      },
    };
  },
};

export default logistic;
