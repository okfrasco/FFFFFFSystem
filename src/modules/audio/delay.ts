/**
 * Delay con feedback filtrato. Con 1 o 2 voci in ingresso lavora per canale
 * (mono o stereo), con più voci le somma in mono. Il tempo si muove liscio
 * (niente click), con l'effetto nastro quando lo si modula.
 */

import { channel, onePole } from '../../core/dsp';
import type { ModuleDefinition } from '../../core/types';

const MAX_SECONDS = 2;

export const delay: ModuleDefinition = {
  manifest: {
    id: 'delay',
    name: 'Delay',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'time', label: 'Tempo', min: 0.005, max: MAX_SECONDS, default: 0.375, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.4, kind: 'continuous' },
      { id: 'tone', label: 'Tono', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    let bufs: Float32Array[] = [];
    let write = 0;
    let cur: number[] = [];
    let lp: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const inVoices = input?.channels.length ?? 1;
        const n = inVoices <= 2 ? inVoices : 1;
        const sr = ctx.sampleRate;
        const size = Math.ceil(MAX_SECONDS * sr) + 4;
        if (bufs.length !== n || bufs[0]!.length !== size) {
          bufs = Array.from({ length: n }, () => new Float32Array(size));
          cur = new Array<number>(n).fill(ctx.param('time'));
          lp = new Array<number>(n).fill(0);
          write = 0;
        }
        const out = outputs.audio('out', n).channels;
        const target = ctx.param('time');
        const fb = ctx.param('feedback');
        const mix = ctx.param('mix');
        const toneCoef = 0.05 + 0.95 * ctx.param('tone');
        const glide = onePole(0.08, sr);
        for (let v = 0; v < n; v++) {
          const buf = bufs[v]!;
          const o = out[v]!;
          const x = n === inVoices ? channel(input, v) : undefined;
          let w = write;
          let time = cur[v]!;
          let l = lp[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            let dry = 0;
            if (x) dry = x[i]!;
            else if (input) for (const ch of input.channels) dry += ch[i]! / inVoices;
            time += (target - time) * glide;
            let r = w - time * sr;
            if (r < 0) r += size;
            const r0 = Math.floor(r);
            const frac = r - r0;
            const y = buf[r0 % size]! * (1 - frac) + buf[(r0 + 1) % size]! * frac;
            l += (y - l) * toneCoef;
            buf[w] = dry + l * fb;
            o[i] = dry * (1 - mix) + y * mix;
            w = w + 1 === size ? 0 : w + 1;
          }
          cur[v] = time;
          lp[v] = Number.isFinite(l) ? l : 0;
          if (v === n - 1) write = w;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};
