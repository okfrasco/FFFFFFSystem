/**
 * Delay con feedback filtrato. Con 1 o 2 voci in ingresso lavora per canale
 * (mono o stereo), con più voci le somma in mono. Il tempo si muove liscio
 * (niente click), con l'effetto nastro quando lo si modula.
 *
 * A tempo: il tempo è una divisione della battuta (terzine e puntati
 * compresi) al BPM del parametro o dell'ingresso `bpm` (Transport.tempo).
 * Modulazione: un LFO interno sposta il tempo di qualche millisecondo
 * (chorus, nastro che ondeggia; in stereo i due canali sono in quadratura).
 * Ping-pong: in stereo il feedback passa da un canale all'altro.
 */

import { channel, onePole } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

const MAX_SECONDS = 4;

/** Divisioni per il modo a tempo, in beat (semiminime). */
export const DIVISIONS: readonly [string, number][] = [
  ['1/32', 0.125],
  ['1/16T', 1 / 6],
  ['1/16', 0.25],
  ['1/8T', 1 / 3],
  ['1/16.', 0.375],
  ['1/8', 0.5],
  ['1/4T', 2 / 3],
  ['1/8.', 0.75],
  ['1/4', 1],
  ['1/2T', 4 / 3],
  ['1/4.', 1.5],
  ['1/2', 2],
  ['1/2.', 3],
  ['1/1', 4],
];

export const delay: ModuleDefinition = {
  manifest: {
    id: 'delay',
    name: 'Delay',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'bpm', type: 'control', signal: 'value' },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'time', label: 'Tempo', min: 0.005, max: MAX_SECONDS, default: 0.375, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.4, kind: 'continuous' },
      { id: 'tone', label: 'Tono', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'sync', label: 'Tempo da', min: 0, max: 1, default: 0, kind: 'discrete', options: ['secondi', 'divisione'] },
      { id: 'division', label: 'Divisione', min: 0, max: DIVISIONS.length - 1, default: 7, kind: 'discrete', options: DIVISIONS.map((d) => d[0]) },
      { id: 'bpm', label: 'BPM', min: 20, max: 300, default: 120, kind: 'continuous' },
      { id: 'modRate', label: 'Mod velocità', min: 0.05, max: 8, default: 0.4, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'modDepth', label: 'Mod profondità', min: 0, max: 0.02, default: 0, kind: 'continuous', unit: 's' },
      { id: 'pingpong', label: 'Ping-pong', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
    ],
    seeded: false,
  },

  create() {
    let bufs: Float32Array[] = [];
    let write = 0;
    let cur: number[] = [];
    let lp: number[] = [];
    let lfo = 0;
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
        const bpmIn = inputs.control('bpm');
        const bpm = Math.max(20, bpmIn ? bpmIn.values[0]! : ctx.param('bpm'));
        const target = Math.min(
          MAX_SECONDS - 0.05,
          ctx.discrete('sync', 0) === 1 ? (DIVISIONS[ctx.discrete('division', 0)]![1] * 60) / bpm : ctx.param('time'),
        );
        const depth = ctx.param('modDepth');
        const lfoInc = ctx.param('modRate') / sr;
        const ping = n === 2 && ctx.discrete('pingpong', 0) === 1;
        const fb = ctx.param('feedback');
        const mix = ctx.param('mix');
        const toneCoef = 0.05 + 0.95 * ctx.param('tone');
        const glide = onePole(0.08, sr);
        const xs = Array.from({ length: n }, (_, v) => (n === inVoices ? channel(input, v) : undefined));
        const ls = lp.slice(0, n);
        const times = cur.slice(0, n);
        let w = write;
        for (let i = 0; i < ctx.frames; i++) {
          lfo += lfoInc;
          if (lfo >= 1) lfo -= 1;
          let mono = 0;
          if (input && n !== inVoices) for (const ch of input.channels) mono += ch[i]! / inVoices;
          for (let v = 0; v < n; v++) {
            const buf = bufs[v]!;
            times[v] = times[v]! + (target - times[v]!) * glide;
            // in stereo i due LFO sono in quadratura
            const mod = depth > 0 ? depth * (1 + Math.sin(2 * Math.PI * (lfo + v * 0.25))) * 0.5 : 0;
            let r = w - (times[v]! + mod) * sr;
            if (r < 0) r += size;
            const r0 = Math.floor(r);
            const frac = r - r0;
            const y = buf[r0 % size]! * (1 - frac) + buf[(r0 + 1) % size]! * frac;
            ls[v] = ls[v]! + (y - ls[v]!) * toneCoef;
            const dry = xs[v] ? xs[v]![i]! : mono;
            out[v]![i] = dry * (1 - mix) + y * mix;
          }
          for (let v = 0; v < n; v++) {
            const dry = xs[v] ? xs[v]![i]! : mono;
            // ping-pong: il feedback di un canale rientra nell'altro
            const back = ping ? ls[1 - v]! : ls[v]!;
            bufs[v]![w] = dry + back * fb;
          }
          w = w + 1 === size ? 0 : w + 1;
        }
        write = w;
        for (let v = 0; v < n; v++) {
          cur[v] = times[v]!;
          lp[v] = Number.isFinite(ls[v]!) ? ls[v]! : 0;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default delay;
