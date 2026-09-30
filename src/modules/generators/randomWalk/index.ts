/**
 * Random walk — passi casuali a ogni step del clock (ingresso trig, oppure
 * la fase con `steps` step per ciclo). Il valore vaga ma non scappa:
 *
 *   size     ampiezza tipica di un passo
 *   attract  richiamo verso il centro (0 = vaga libero, 1 = torna subito)
 *   lo / hi  i limiti: il valore ci rimbalza contro
 *   glide    il valore in uscita scivola verso il nuovo passo in `glide` secondi
 *
 * Un trigger a ogni passo, che porta il valore (per Quantize, Memoria…).
 */

import { clockHits } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';

interface WalkState {
  x: number;
  shown: number;
  counter: number;
}

/** Un passo: gaussiano, richiamato verso il centro, riflesso sui limiti. */
export function walkStep(x: number, noise: number, size: number, attract: number, center: number, lo: number, hi: number): number {
  let y = x + noise * size - attract * (x - center);
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  if (b - a < 1e-9) return a;
  for (let i = 0; i < 4 && (y < a || y > b); i++) y = y < a ? 2 * a - y : 2 * b - y;
  return Math.max(a, Math.min(b, y));
}

export const randomWalk: ModuleDefinition = {
  manifest: {
    id: 'randomWalk',
    name: 'Random walk',
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
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
      { id: 'size', label: 'Passo', min: 0, max: 0.5, default: 0.1, kind: 'continuous' },
      { id: 'attract', label: 'Attrazione', min: 0, max: 1, default: 0.05, kind: 'continuous' },
      { id: 'center', label: 'Centro', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'lo', label: 'Minimo', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'glide', label: 'Glide', min: 0, max: 2, default: 0, kind: 'continuous', unit: 's' },
      ...STANDARD_GENERATOR_PARAMS.filter((p) => p.id === 'swing'),
    ],
    seeded: true,
  },
  create() {
    let s: WalkState = { x: 0.5, shown: 0.5, counter: 0 };
    return {
      process(ctx, inputs, outputs) {
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          s.x = walkStep(s.x, ctx.rng.gaussian(), ctx.param('size'), ctx.param('attract'), ctx.param('center'), ctx.param('lo'), ctx.param('hi'));
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: s.x });
        }
        const glide = ctx.param('glide');
        s.shown = glide > 0 ? s.shown + (s.x - s.shown) * (1 - Math.exp(-ctx.dt / (glide / 3))) : s.x;
        outputs.control('out').values[0] = s.shown;
        trig.values[0] = 1;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as WalkState) };
      },
    };
  },
};

export default randomWalk;
