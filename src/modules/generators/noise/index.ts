/**
 * Noise — rumore come modulazione, lento o veloce:
 *
 *   perlin   rumore liscio a gradienti (Perlin 1D), con ottave
 *   bianco   un valore nuovo a ogni campione di rumore
 *   rosa     meno salti veloci, più movimenti lenti (1/f, Voss-McCartney)
 *   marrone  una passeggiata che scivola (1/f²)
 *
 * `rate` è quante variazioni al secondo, oppure per ciclo se la fase è
 * collegata (a tempo). Uscita 0–1 (o −1…1).
 */

import { hash01 } from '../../../core/rng';
import type { ModuleDefinition } from '../../../core/types';

export const NOISE_KINDS = ['perlin', 'bianco', 'rosa', 'marrone'] as const;

/** Perlin 1D in [−1, 1] (gradienti dal seed, raccordo quintico), con ottave. */
export function perlin1(seed: number, x: number, octaves = 1): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    const xi = Math.floor(x * f);
    const t = x * f - xi;
    const g0 = hash01(seed, o, xi) * 2 - 1;
    const g1 = hash01(seed, o, xi + 1) * 2 - 1;
    const fade = t * t * t * (t * (t * 6 - 15) + 10);
    // il Perlin 1D vale al più ±0.5: ×2 per usare tutto l'intervallo
    sum += amp * 2 * (g0 * t + (g1 * (t - 1) - g0 * t) * fade);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return Math.max(-1, Math.min(1, sum / norm));
}

interface NoiseState {
  pos: number;
  held: number;
  target: number;
  rows: number[];
  brown: number;
  count: number;
}

export const noise: ModuleDefinition = {
  manifest: {
    id: 'noise',
    name: 'Noise',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'control', signal: 'value' }],
    params: [
      { id: 'kind', label: 'Tipo', min: 0, max: NOISE_KINDS.length - 1, default: 0, kind: 'discrete', options: [...NOISE_KINDS] },
      { id: 'rate', label: 'Velocità', min: 0.05, max: 50, default: 2, kind: 'continuous', curve: 'exp' },
      { id: 'octaves', label: 'Ottave', min: 1, max: 6, default: 2, kind: 'discrete' },
      { id: 'polarity', label: 'Polarità', min: 0, max: 1, default: 0, kind: 'discrete', options: ['0…1', '−1…1'] },
    ],
    seeded: true,
  },
  create(init) {
    const seed = init.seed;
    let s: NoiseState = { pos: 0, held: 0, target: 0, rows: [0, 0, 0, 0, 0], brown: 0, count: 0 };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        const adv = (ph ? Math.max(0, ph.end[0]! - ph.start[0]!) : ctx.dt) * ctx.param('rate');
        const kind = ctx.discrete('kind', ctx.tick);
        const prev = Math.floor(s.pos);
        s.pos += adv;
        let y: number;
        if (kind === 0) y = perlin1(seed, s.pos, ctx.discrete('octaves', ctx.tick));
        else {
          // un campione nuovo a ogni intero attraversato, poi un raccordo breve
          for (let k = prev + 1; k <= Math.floor(s.pos); k++) {
            s.count++;
            const white = ctx.rng.float() * 2 - 1;
            if (kind === 2) {
              // Voss-McCartney: la riga i si aggiorna ogni 2^i campioni
              for (let r = 0; r < s.rows.length; r++) if (s.count % (1 << r) === 0) s.rows[r] = ctx.rng.float() * 2 - 1;
              s.target = s.rows.reduce((a, b) => a + b, 0) / s.rows.length;
            } else if (kind === 3) {
              s.brown = Math.max(-1, Math.min(1, s.brown * 0.98 + white * 0.25));
              s.target = s.brown;
            } else s.target = white;
          }
          s.held += (s.target - s.held) * Math.min(1, adv * 4 + 0.3);
          y = s.held;
        }
        outputs.control('out').values[0] = ctx.discrete('polarity', ctx.tick) === 1 ? y : 0.5 + 0.5 * y;
      },
      getState: () => ({ ...s, rows: [...s.rows] }),
      setState(state) {
        const st = state as NoiseState;
        s = { ...st, rows: [...st.rows] };
      },
    };
  },
};

export default noise;
