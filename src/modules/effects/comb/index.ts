/**
 * Comb — un ritardo cortissimo con feedback: picchi a multipli della sua
 * frequenza (feedback positivo) o solo armoniche dispari (negativo). La
 * frequenza viene dal parametro o dall'ingresso `pitch` (Voci): il comb
 * diventa una corda risonante suonata dal segnale in ingresso. `damping`
 * scurisce il giro. Feedforward: buchi invece di picchi (flanger statico).
 */

import { channel, mtof } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const COMB_MODES = ['feedback', 'feedforward'] as const;

/** Risposta del comb alla frequenza f (per la view). */
export function combResponse(f: number, f0: number, fb: number, mode: number): number {
  const w = (2 * Math.PI * f) / f0;
  if (mode === 1) return Math.hypot(1 + fb * Math.cos(w), fb * Math.sin(w)) / (1 + Math.abs(fb));
  return (1 - Math.abs(fb)) / Math.hypot(1 - fb * Math.cos(w), fb * Math.sin(w));
}

const MAX_DELAY = 4096;

export const comb: ModuleDefinition = {
  manifest: {
    id: 'comb',
    name: 'Comb',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'pitch', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: [...COMB_MODES] },
      { id: 'freq', label: 'Frequenza', min: 20, max: 4000, default: 220, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'feedback', label: 'Feedback', min: -0.995, max: 0.995, default: 0.85, kind: 'continuous' },
      { id: 'damping', label: 'Smorzamento', min: 0, max: 1, default: 0.2, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const bufs: Float32Array[] = [];
    const ws: number[] = [];
    const lps: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const pitchIn = inputs.audio('pitch');
        const n = Math.max(input?.channels.length ?? 1, pitchIn?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        while (bufs.length < n) {
          bufs.push(new Float32Array(MAX_DELAY));
          ws.push(0);
          lps.push(0);
        }
        const sr = ctx.sampleRate;
        const ff = ctx.discrete('mode', 0) === 1;
        const fb = ctx.param('feedback');
        const damp = 1 - 0.95 * ctx.param('damping');
        const mix = ctx.param('mix');
        const freq = ctx.param('freq');
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const p = channel(pitchIn, v);
          const buf = bufs[v]!;
          const o = out[v]!;
          let w = ws[v]!;
          let lp = lps[v]!;
          let d = sr / freq;
          let last = NaN;
          for (let i = 0; i < ctx.frames; i++) {
            if (p && p[i] !== last) {
              last = p[i]!;
              d = sr / mtof(last);
            }
            d = Math.max(2, Math.min(MAX_DELAY - 2, d));
            let r = w - d;
            if (r < 0) r += MAX_DELAY;
            const r0 = Math.floor(r);
            const fr = r - r0;
            const del = buf[r0 % MAX_DELAY]! * (1 - fr) + buf[(r0 + 1) % MAX_DELAY]! * fr;
            const xin = x ? x[i]! : 0;
            lp += (del - lp) * damp;
            let y: number;
            if (ff) {
              buf[w] = xin;
              y = (xin + fb * lp) / (1 + Math.abs(fb));
            } else {
              y = xin + fb * lp;
              buf[w] = y;
              y *= 1 - Math.abs(fb);
            }
            o[i] = xin * (1 - mix) + y * mix;
            w = w + 1 === MAX_DELAY ? 0 : w + 1;
          }
          ws[v] = w;
          lps[v] = Number.isFinite(lp) ? lp : 0;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default comb;
