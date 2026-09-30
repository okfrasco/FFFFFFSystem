/**
 * S&H Random — valori casuali a scalini o smussati, tra lo e hi. A ogni step
 * (la fase con `steps` step per ciclo, oppure un trigger) un valore nuovo.
 * Con la fase, `smooth` fa scivolare verso il valore successivo nell'ultima
 * parte dello step (0 = scalini secchi, 1 = curva continua).
 *
 * I valori dipendono solo da seed e numero di step: riproducibili, e la view
 * li può disegnare in anticipo.
 */

import { clockHits } from '../../../core/phase';
import { hash01 } from '../../../core/rng';
import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

/** Valore allo step k, 0–1. */
export const shValue = (seed: number, k: number): number => hash01(seed, 0x5e, k);

/** Valore continuo alla posizione x (in step), con la parte smussata alla fine di ogni step. */
export function shAt(seed: number, x: number, smooth: number): number {
  const k = Math.floor(x);
  const f = x - k;
  const a = shValue(seed, k);
  if (smooth <= 0) return a;
  const b = shValue(seed, k + 1);
  const g = Math.max(0, Math.min(1, (f - (1 - smooth)) / smooth));
  return a + (b - a) * (g * g * (3 - 2 * g));
}

export const shRandom: ModuleDefinition = {
  manifest: {
    id: 'shRandom',
    name: 'S&H Random',
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
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 4, kind: 'discrete' },
      { id: 'smooth', label: 'Smussa', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'lo', label: 'Minimo', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    const seed = init.seed;
    let counter = 0;
    let current = 0;
    return {
      process(ctx, inputs, outputs) {
        const lo = ctx.param('lo');
        const hi = ctx.param('hi');
        const scale = (u: number) => lo + (hi - lo) * u;
        const c = { n: counter };
        const hits = clockHits(ctx, inputs, c);
        counter = c.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          current = shValue(seed, hit.key);
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: scale(current) });
        }
        const ph = inputs.phase('phase');
        const viaPhase = ph && !inputs.control('trig');
        const u = viaPhase ? shAt(seed, readVoice(ph.end, 0) * ctx.discrete('steps', ctx.tick), ctx.param('smooth')) : current;
        outputs.control('out').values[0] = scale(u);
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

export default shRandom;
