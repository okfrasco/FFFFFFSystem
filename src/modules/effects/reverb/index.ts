/**
 * Reverb FDN a 8 linee con matrice di Householder e smorzamento per linea.
 * Il decadimento è un T60 in secondi; `size` scala le lunghezze delle linee.
 * Ingresso sommato in mono (o tenuto stereo se arriva a 2 voci), uscita
 * stereo: 2 voci, sinistra e destra.
 *
 * Tipo "plate": linee più corte e quattro allpass in ingresso che diffondono
 * subito l'attacco (denso e brillante, senza eco iniziali). Freeze: le linee
 * girano senza perdite e senza ingresso, la coda resta sospesa.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

const BASE = [1051, 1123, 1237, 1327, 1423, 1531, 1613, 1747];
const PLATE = [557, 613, 701, 787, 853, 929, 1009, 1103];
const DIFFUSERS = [142, 107, 379, 277];
export const REVERB_TYPES = ['sala', 'plate'] as const;

export const reverb: ModuleDefinition = {
  manifest: {
    id: 'reverb',
    name: 'Reverb',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'size', label: 'Dimensione', min: 0.1, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'decay', label: 'Decadimento', min: 0.2, max: 20, default: 2.5, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'damping', label: 'Smorzamento', min: 0, max: 1, default: 0.4, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 0.25, kind: 'continuous' },
      { id: 'type', label: 'Tipo', min: 0, max: 1, default: 0, kind: 'discrete', options: [...REVERB_TYPES] },
      { id: 'freeze', label: 'Freeze', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
    ],
    seeded: false,
  },

  create() {
    let lines: Float32Array[] = [];
    let lp = new Float64Array(8);
    let w = 0;
    let len = 0;
    let diff: Float32Array[] = [];
    const dw = [0, 0, 0, 0];
    return {
      process(ctx, inputs, outputs) {
        const sr = ctx.sampleRate;
        const scale = sr / 44100;
        const max = Math.ceil(BASE[7]! * scale) + 2;
        if (len !== max) {
          len = max;
          lines = BASE.map(() => new Float32Array(max));
          lp = new Float64Array(8);
          w = 0;
          diff = DIFFUSERS.map((d) => new Float32Array(Math.ceil(d * scale) + 1));
        }
        const input = inputs.audio('in');
        const inVoices = input?.channels.length ?? 1;
        const out = outputs.audio('out', 2).channels;
        const size = ctx.param('size');
        const t60 = ctx.param('decay');
        const plate = ctx.discrete('type', 0) === 1;
        const freeze = ctx.discrete('freeze', 0) === 1;
        const damp = freeze ? 1 : 1 - (plate ? 0.6 : 0.9) * ctx.param('damping');
        const mix = ctx.param('mix');
        const lengths = (plate ? PLATE : BASE).map((b) => Math.max(8, Math.floor(b * scale * size)));
        const gains = lengths.map((l) => (freeze ? 1 : Math.pow(10, (-3 * l) / (sr * t60))));
        const inGain = freeze ? 0 : 0.35;
        const o = new Float64Array(8);
        const L = channel(input, 0);
        const R = inVoices === 2 ? channel(input, 1) : undefined;
        for (let i = 0; i < ctx.frames; i++) {
          let dryL = 0;
          let dryR = 0;
          if (inVoices === 2) {
            dryL = L![i]!;
            dryR = R![i]!;
          } else if (input) {
            for (const ch of input.channels) dryL += ch[i]!;
            dryR = dryL;
          }
          let x = (dryL + dryR) * 0.5;
          if (plate) {
            // diffusione: allpass di Schroeder in serie
            for (let d = 0; d < diff.length; d++) {
              const buf = diff[d]!;
              const j = dw[d]!;
              const delayed = buf[j]!;
              const v = x + 0.7 * delayed;
              buf[j] = v;
              x = delayed - 0.7 * v;
              dw[d] = j + 1 === buf.length ? 0 : j + 1;
            }
          }
          let sum = 0;
          for (let k = 0; k < 8; k++) {
            let r = w - lengths[k]!;
            if (r < 0) r += len;
            lp[k] = lp[k]! + (lines[k]![r]! - lp[k]!) * damp;
            o[k] = lp[k]!;
            sum += o[k]!;
          }
          sum *= 2 / 8;
          for (let k = 0; k < 8; k++) lines[k]![w] = (o[k]! - sum) * gains[k]! + x * inGain;
          const wetL = (o[0]! + o[2]! + o[4]! + o[6]!) * 0.35;
          const wetR = (o[1]! + o[3]! + o[5]! + o[7]!) * 0.35;
          out[0]![i] = dryL * (1 - mix) + wetL * mix;
          out[1]![i] = dryR * (1 - mix) + wetR * mix;
          w = w + 1 === len ? 0 : w + 1;
        }
        for (let k = 0; k < 8; k++) if (!Number.isFinite(lp[k]!)) lp[k] = 0;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default reverb;
