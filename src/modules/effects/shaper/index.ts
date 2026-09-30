/**
 * Shaper — distorsione per curva di trasferimento, con oversampling 2×:
 *
 *   fold        wavefolder sinusoidale: più drive = più pieghe = più armoniche
 *   satura      tanh normalizzata: compressione morbida, calda
 *   chebyshev   polinomio di Chebyshev di ordine `order`: aggiunge l'armonica
 *               `order` a un seno a piena ampiezza
 *
 * `symmetry` sposta il segnale prima della curva (armoniche pari), e un filtro
 * toglie la componente continua che ne risulta. `mix` tra pulito e distorto.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const SHAPER_MODES = ['fold', 'satura', 'chebyshev'] as const;

/** Chebyshev T_n(x) per x in [−1, 1]. */
function cheby(n: number, x: number): number {
  let t0 = 1;
  let t1 = x;
  if (n === 0) return t0;
  for (let k = 2; k <= n; k++) {
    const t2 = 2 * x * t1 - t0;
    t0 = t1;
    t1 = t2;
  }
  return t1;
}

/** La curva: ingresso già moltiplicato per drive, uscita circa in [−1, 1]. */
export function shape(mode: number, x: number, drive: number, order: number): number {
  switch (mode) {
    case 0:
      return Math.sin((Math.PI / 2) * x * drive);
    case 1:
      return Math.tanh(x * drive) / Math.tanh(Math.max(1e-3, drive));
    default: {
      const c = Math.max(-1, Math.min(1, x * drive));
      return cheby(order, c);
    }
  }
}

interface ShaperState {
  prev: number[];
  dcIn: number[];
  dcOut: number[];
}

export const shaper: ModuleDefinition = {
  manifest: {
    id: 'shaper',
    name: 'Shaper',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: SHAPER_MODES.length - 1, default: 0, kind: 'discrete', options: [...SHAPER_MODES] },
      { id: 'drive', label: 'Drive', min: 0.1, max: 20, default: 2, kind: 'continuous', curve: 'exp' },
      { id: 'order', label: 'Ordine', min: 2, max: 9, default: 3, kind: 'discrete' },
      { id: 'symmetry', label: 'Simmetria', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'level', label: 'Livello', min: 0, max: 2, default: 0.7, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: ShaperState = { prev: [], dcIn: [], dcOut: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (s.prev.length < n) {
          s.prev.push(0);
          s.dcIn.push(0);
          s.dcOut.push(0);
        }
        const mode = ctx.discrete('mode', 0);
        const drive = ctx.param('drive');
        const order = ctx.discrete('order', 0);
        const bias = ctx.param('symmetry') * 0.5;
        const mix = ctx.param('mix');
        const level = ctx.param('level');
        const R = 0.995; // filtro anti-DC: y = x − x₋₁ + R·y₋₁
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const o = out[v]!;
          let prev = s.prev[v]!;
          let dcIn = s.dcIn[v]!;
          let dcOut = s.dcOut[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            const cur = x ? x[i]! : 0;
            // oversampling 2×: il campione a metà (interpolato) e quello vero, poi la media
            const mid = (prev + cur) * 0.5;
            const wet = 0.5 * (shape(mode, mid + bias, drive, order) + shape(mode, cur + bias, drive, order));
            prev = cur;
            const y = wet - dcIn + R * dcOut;
            dcIn = wet;
            dcOut = y;
            o[i] = (cur * (1 - mix) + y * mix) * level;
          }
          s.prev[v] = prev;
          s.dcIn[v] = dcIn;
          s.dcOut[v] = Number.isFinite(dcOut) ? dcOut : 0;
        }
      },
      getState: () => ({ prev: [...s.prev], dcIn: [...s.dcIn], dcOut: [...s.dcOut] }),
      setState(state) {
        const st = state as ShaperState;
        s = { prev: [...st.prev], dcIn: [...st.dcIn], dcOut: [...st.dcOut] };
      },
    };
  },
};

export default shaper;
