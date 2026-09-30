/**
 * Serie infinita — la serie di Per Nørgård: a(0) = 0, a(2n) = −a(n),
 * a(2n+1) = a(n) + 1. Una melodia che contiene se stessa: leggendone un
 * termine ogni 4 si ritrova la stessa serie (ogni 2, capovolta).
 * A ogni step esce a(start + stride·k) × interval, come valore e sul
 * trigger (verso Quantize in modo grado).
 */

import { clockHits } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export function norgard(n: number): number {
  let m = Math.max(0, Math.floor(n));
  // si leggono i bit dal più significativo: 1 → +1, 0 → cambio di segno
  const bits: number[] = [];
  while (m > 0) {
    bits.push(m & 1);
    m >>= 1;
  }
  let a = 0;
  for (let i = bits.length - 1; i >= 0; i--) a = bits[i] ? a + 1 : -a;
  return a + 0; // niente −0
}

export const infinitySeries: ModuleDefinition = {
  manifest: {
    id: 'infinitySeries',
    name: 'Serie infinita',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'start', label: 'Inizio', min: 0, max: 1023, default: 0, kind: 'discrete' },
      { id: 'stride', label: 'Passo', min: 1, max: 16, default: 1, kind: 'discrete' },
      { id: 'interval', label: 'Intervallo', min: -4, max: 4, default: 1, kind: 'discrete' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let counter = 0;
    let current = 0;
    return {
      process(ctx, inputs, outputs) {
        const c = { n: counter };
        const hits = clockHits(ctx, inputs, c);
        counter = c.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          const n = ctx.discrete('start', hit.key) + ctx.discrete('stride', hit.key) * Math.max(0, hit.key);
          current = norgard(n) * ctx.discrete('interval', hit.key);
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: current });
        }
        outputs.control('value').values[0] = current;
        trig.values[0] = 1;
      },
      getState: () => ({ counter, current }),
      setState(state) {
        const st = state as { counter: number; current: number };
        counter = st.counter;
        current = st.current;
      },
    };
  },
};

export default infinitySeries;
