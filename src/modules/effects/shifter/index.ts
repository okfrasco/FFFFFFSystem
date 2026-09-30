/**
 * Freq / Pitch Shift — due modi:
 *   frequenza  sposta tutto lo spettro di `shift` Hz (modulazione a banda
 *              laterale singola con un Hilbert a due catene di allpass):
 *              gli armonici non restano armonici, il suono diventa metallico
 *   pitch      sposta di `semitones` con due letture di un ritardo che
 *              scorrono a velocità diversa, in dissolvenza incrociata
 * Il feedback rimanda l'uscita all'ingresso attraverso un ritardo (`delay`):
 * a ogni giro lo spostamento si somma, e il suono sale o scende a spirale
 * (l'effetto barber-pole).
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const SHIFT_MODES = ['frequenza', 'pitch'] as const;

// coefficienti di Olli Niemitalo: due catene di allpass sfasate di 90°
const A = [0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737].map((c) => c * c);
const B = [0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278].map((c) => c * c);

interface Chain {
  x1: Float64Array;
  x2: Float64Array;
  y1: Float64Array;
  y2: Float64Array;
}
const chain = (): Chain => ({ x1: new Float64Array(4), x2: new Float64Array(4), y1: new Float64Array(4), y2: new Float64Array(4) });

function runChain(c: Chain, coefs: readonly number[], x: number): number {
  for (let k = 0; k < 4; k++) {
    const y = coefs[k]! * (x + c.y2[k]!) - c.x2[k]!;
    c.x2[k] = c.x1[k]!;
    c.x1[k] = x;
    c.y2[k] = c.y1[k]!;
    c.y1[k] = y;
    x = y;
  }
  return x;
}

interface ShiftState {
  a: Chain;
  b: Chain;
  bPrev: number;
  osc: number;
  fbBuf: Float32Array;
  fbW: number;
  pBuf: Float32Array;
  pW: number;
  pPh: number;
}

const P_SIZE = 8192;
const WINDOW = 0.05;

export const shifter: ModuleDefinition = {
  manifest: {
    id: 'shifter',
    name: 'Freq / Pitch Shift',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: [...SHIFT_MODES] },
      { id: 'shift', label: 'Spostamento', min: -1000, max: 1000, default: 30, kind: 'continuous', unit: 'Hz' },
      { id: 'semitones', label: 'Semitoni', min: -24, max: 24, default: 7, kind: 'continuous', unit: 'st' },
      { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0, kind: 'continuous' },
      { id: 'delay', label: 'Ritardo', min: 0.005, max: 2, default: 0.25, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const st: ShiftState[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const n = Math.min(2, input?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        const sr = ctx.sampleRate;
        while (st.length < n) {
          st.push({ a: chain(), b: chain(), bPrev: 0, osc: 0, fbBuf: new Float32Array(Math.ceil(sr * 2) + 8), fbW: 0, pBuf: new Float32Array(P_SIZE), pW: 0, pPh: 0 });
        }
        const pitchMode = ctx.discrete('mode', 0) === 1;
        const dOsc = ctx.param('shift') / sr;
        const ratio = Math.pow(2, ctx.param('semitones') / 12);
        const fb = ctx.param('feedback');
        const dly = Math.max(1, Math.round(ctx.param('delay') * sr));
        const mix = ctx.param('mix');
        const win = Math.round(WINDOW * sr);
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const o = out[v]!;
          const s = st[v]!;
          const fbLen = s.fbBuf.length;
          for (let i = 0; i < ctx.frames; i++) {
            const dry = x ? x[i]! : 0;
            let r = s.fbW - dly;
            if (r < 0) r += fbLen;
            const xin = dry + fb * s.fbBuf[r]!;
            let y: number;
            if (!pitchMode) {
              const re = runChain(s.a, A, xin);
              const im = s.bPrev;
              s.bPrev = runChain(s.b, B, xin);
              s.osc += dOsc;
              s.osc -= Math.floor(s.osc);
              const c = Math.cos(2 * Math.PI * s.osc);
              const sn = Math.sin(2 * Math.PI * s.osc);
              y = re * c - im * sn;
            } else {
              // due letture a mezzo periodo di distanza, con finestra triangolare
              s.pBuf[s.pW] = xin;
              s.pPh += (1 - ratio) / win;
              s.pPh -= Math.floor(s.pPh);
              y = 0;
              for (const off of [0, 0.5]) {
                const p = (s.pPh + off) % 1;
                let rr = s.pW - p * win - 2;
                if (rr < 0) rr += P_SIZE;
                const r0 = Math.floor(rr);
                const fr = rr - r0;
                const smp = s.pBuf[r0 % P_SIZE]! * (1 - fr) + s.pBuf[(r0 + 1) % P_SIZE]! * fr;
                y += smp * (1 - Math.abs(2 * p - 1));
              }
              s.pW = s.pW + 1 === P_SIZE ? 0 : s.pW + 1;
            }
            s.fbBuf[s.fbW] = Math.tanh(y);
            s.fbW = s.fbW + 1 === fbLen ? 0 : s.fbW + 1;
            o[i] = dry * (1 - mix) + y * mix;
          }
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default shifter;
