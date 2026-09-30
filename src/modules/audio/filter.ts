/**
 * Filtro SVF (topologia TPT di Zavalishin): passa-basso, passa-banda,
 * passa-alto, notch. `mod` sposta il cutoff in ottave (±6 a profondità 1),
 * ad esempio con un inviluppo; senza `mod` i coefficienti si calcolano una
 * volta per blocco.
 */

import { channel } from '../../core/dsp';
import type { ModuleDefinition } from '../../core/types';

interface SvfState {
  ic1: number[];
  ic2: number[];
}

export const filter: ModuleDefinition = {
  manifest: {
    id: 'filter',
    name: 'Filtro',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'mod', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 3, default: 0, kind: 'discrete', options: ['passa-basso', 'passa-banda', 'passa-alto', 'notch'] },
      { id: 'cutoff', label: 'Cutoff', min: 20, max: 20000, default: 1200, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'resonance', label: 'Risonanza', min: 0, max: 1, default: 0.2, kind: 'continuous' },
      { id: 'modDepth', label: 'Mod', min: -1, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    let s: SvfState = { ic1: [], ic2: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const modIn = inputs.audio('mod');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (s.ic1.length < n) {
          s.ic1.push(0);
          s.ic2.push(0);
        }
        const sr = ctx.sampleRate;
        const mode = ctx.discrete('mode', 0);
        const cutoff = ctx.param('cutoff');
        const k = 2 - 1.98 * ctx.param('resonance');
        const depth = ctx.param('modDepth') * 6;
        const maxF = 0.45 * sr;
        const coefs = (fc: number) => {
          const g = Math.tan((Math.PI * Math.min(maxF, Math.max(10, fc))) / sr);
          const a1 = 1 / (1 + g * (g + k));
          return [a1, g * a1, g * g * a1] as const;
        };
        let [a1, a2, a3] = coefs(cutoff);
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const m = depth !== 0 ? channel(modIn, v) : undefined;
          const o = out[v]!;
          let ic1 = s.ic1[v]!;
          let ic2 = s.ic2[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            if (m) [a1, a2, a3] = coefs(cutoff * Math.pow(2, depth * m[i]!));
            const v0 = x ? x[i]! : 0;
            const v3 = v0 - ic2;
            const v1 = a1 * ic1 + a2 * v3;
            const v2 = ic2 + a2 * ic1 + a3 * v3;
            ic1 = 2 * v1 - ic1;
            ic2 = 2 * v2 - ic2;
            o[i] = mode === 0 ? v2 : mode === 1 ? v1 : mode === 2 ? v0 - k * v1 - v2 : v0 - k * v1;
          }
          // protezione da valori non finiti (es. risonanza estrema con segnali enormi)
          s.ic1[v] = Number.isFinite(ic1) ? ic1 : 0;
          s.ic2[v] = Number.isFinite(ic2) ? ic2 : 0;
        }
      },
      getState: () => ({ ic1: [...s.ic1], ic2: [...s.ic2] }),
      setState(state) {
        const st = state as SvfState;
        s = { ic1: [...st.ic1], ic2: [...st.ic2] };
      },
    };
  },
};
