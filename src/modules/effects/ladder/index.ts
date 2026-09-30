/**
 * Ladder — il filtro a quattro poli dei Moog: quattro passa-basso a un polo
 * in cascata con il feedback dell'ultimo sul primo, saturato (tanh). Con la
 * risonanza al massimo auto-oscilla. Gira a doppia frequenza di campionamento
 * per restare stabile e intonato sulle frequenze alte. Uscite miscelate dagli
 * stadi: 24 dB, 12 dB, passa-banda, passa-alto.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const LADDER_MODES = ['LP 24', 'LP 12', 'passa-banda', 'passa-alto'] as const;

/** Guadagno (0–∞) del ladder lineare alla frequenza f (per la view). */
export function ladderResponse(f: number, fc: number, k: number, mode: number): number {
  const s = { re: 0, im: f / fc };
  // H1 = 1 / (1 + s): uno stadio
  const d = 1 + s.im * s.im;
  const h1 = { re: 1 / d, im: -s.im / d };
  const mul = (a: { re: number; im: number }, b: { re: number; im: number }) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const h2 = mul(h1, h1);
  const h4 = mul(h2, h2);
  // retroazione: H = G / (1 + k·H4), G = combinazione degli stadi
  const den = { re: 1 + k * h4.re, im: k * h4.im };
  const g = mode === 0 ? h4 : mode === 1 ? h2 : mode === 2 ? { re: h2.re - h4.re, im: h2.im - h4.im } : { re: 1 - 4 * h1.re + 6 * h2.re - 4 * mul(h2, h1).re + h4.re, im: -4 * h1.im + 6 * h2.im - 4 * mul(h2, h1).im + h4.im };
  const dd = den.re * den.re + den.im * den.im;
  return Math.hypot(g.re, g.im) / Math.sqrt(dd) * (1 + k * 0.5);
}

export const ladder: ModuleDefinition = {
  manifest: {
    id: 'ladder',
    name: 'Ladder',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'mod', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: LADDER_MODES.length - 1, default: 0, kind: 'discrete', options: [...LADDER_MODES] },
      { id: 'cutoff', label: 'Cutoff', min: 20, max: 18000, default: 900, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'resonance', label: 'Risonanza', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'drive', label: 'Drive', min: 0.5, max: 8, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'modDepth', label: 'Mod', min: -1, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const st: Float64Array[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const modIn = inputs.audio('mod');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (st.length < n) st.push(new Float64Array(5));
        const sr2 = ctx.sampleRate * 2;
        const mode = ctx.discrete('mode', 0);
        const cutoff = ctx.param('cutoff');
        const k = 4.1 * ctx.param('resonance');
        const drive = ctx.param('drive');
        const depth = ctx.param('modDepth') * 6;
        const comp = 1 + k * 0.5;
        const Gof = (fc: number) => {
          const g = Math.tan((Math.PI * Math.min(0.45 * sr2, Math.max(10, fc))) / sr2);
          return g / (1 + g);
        };
        let G = Gof(cutoff);
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const m = depth !== 0 ? channel(modIn, v) : undefined;
          const o = out[v]!;
          const s = st[v]!;
          let s1 = s[0]!;
          let s2 = s[1]!;
          let s3 = s[2]!;
          let s4 = s[3]!;
          let y4 = s[4]!;
          for (let i = 0; i < ctx.frames; i++) {
            if (m) G = Gof(cutoff * Math.pow(2, depth * m[i]!));
            const xin = (x ? x[i]! : 0) * drive;
            let y = 0;
            let u = 0;
            let y1 = 0;
            let y2 = 0;
            let y3 = 0;
            // due sotto-passi per campione
            for (let sub = 0; sub < 2; sub++) {
              u = Math.tanh(xin * comp - k * y4);
              let vv = (u - s1) * G;
              y1 = vv + s1;
              s1 = y1 + vv;
              vv = (y1 - s2) * G;
              y2 = vv + s2;
              s2 = y2 + vv;
              vv = (y2 - s3) * G;
              y3 = vv + s3;
              s3 = y3 + vv;
              vv = (y3 - s4) * G;
              y4 = vv + s4;
              s4 = y4 + vv;
            }
            y = mode === 0 ? y4 : mode === 1 ? y2 : mode === 2 ? (y2 - y4) * 2 : u - 4 * y1 + 6 * y2 - 4 * y3 + y4;
            o[i] = y / Math.max(1, drive * 0.7);
          }
          const ok = Number.isFinite(y4);
          s[0] = ok ? s1 : 0;
          s[1] = ok ? s2 : 0;
          s[2] = ok ? s3 : 0;
          s[3] = ok ? s4 : 0;
          s[4] = ok ? y4 : 0;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default ladder;
