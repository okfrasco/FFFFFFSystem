/**
 * Spettrale — lavora sullo spettro (STFT a 2048 punti, passo 512, finestra
 * di Hann): 
 *   freeze  tiene l'ultimo spettro e lo fa suonare all'infinito (le fasi
 *           avanzano come in un phase vocoder, con un po' di caso)
 *   smear   le ampiezze si trascinano nel tempo: gli attacchi si sciolgono
 *   blur    le ampiezze si mescolano tra bande vicine: il suono si sfoca
 *   tilt    inclina lo spettro; lowCut e highCut tagliano ai bordi
 * Latenza: 2048 campioni (~43 ms a 48 kHz).
 */

import { channel } from '../../../core/dsp';
import { fft } from '../../../core/fft';
import type { ModuleDefinition } from '../../../core/types';

export const N = 2048;
export const HOP = 512;
const HANN = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
// somma delle finestre (analisi × sintesi) con sovrapposizione 4: costante 1.5
const OLA = 1 / 1.5;

interface Chan {
  /** Ingresso circolare: `iw` è il prossimo da scrivere, cioè il più vecchio. */
  inBuf: Float64Array;
  iw: number;
  outBuf: Float64Array;
  /** Campioni entrati dall'ultimo frame. */
  count: number;
  /** Posizione di lettura nel buffer d'uscita. */
  rd: number;
  mag: Float64Array;
  phase: Float64Array;
  frozenMag: Float64Array | null;
  re: Float64Array;
  im: Float64Array;
}

const chan = (): Chan => ({
  inBuf: new Float64Array(N),
  iw: 0,
  outBuf: new Float64Array(N),
  count: 0,
  rd: 0,
  mag: new Float64Array(N / 2 + 1),
  phase: new Float64Array(N / 2 + 1),
  frozenMag: null,
  re: new Float64Array(N),
  im: new Float64Array(N),
});

export interface SpectralSettings {
  freeze: boolean;
  smear: number;
  blur: number;
  tilt: number;
  lowBin: number;
  highBin: number;
}

/** Guadagno per banda di tilt e tagli (anche per la view). */
export function binGain(k: number, s: SpectralSettings): number {
  if (k < s.lowBin || k > s.highBin) return 0;
  return Math.pow(Math.max(1, k) / 64, s.tilt);
}

/** Un frame: dallo spettro in re/im alle ampiezze elaborate, di nuovo in re/im. */
export function processFrame(c: Chan, s: SpectralSettings, rand: () => number): void {
  const bins = N / 2 + 1;
  const mag = new Float64Array(bins);
  for (let k = 0; k < bins; k++) mag[k] = Math.hypot(c.re[k]!, c.im[k]!);
  // blur tra bande vicine
  if (s.blur > 0) {
    const r = Math.max(1, Math.round(s.blur * 24));
    const acc = new Float64Array(bins);
    for (let k = 0; k < bins; k++) {
      let sum = 0;
      let cnt = 0;
      for (let j = Math.max(0, k - r); j <= Math.min(bins - 1, k + r); j++) {
        sum += mag[j]!;
        cnt++;
      }
      acc[k] = sum / cnt;
    }
    mag.set(acc);
  }
  // smear nel tempo
  for (let k = 0; k < bins; k++) c.mag[k] = s.smear * c.mag[k]! + (1 - s.smear) * mag[k]!;
  if (s.freeze) c.frozenMag ??= Float64Array.from(c.mag);
  else c.frozenMag = null;
  const src = c.frozenMag ?? c.mag;
  for (let k = 0; k < bins; k++) {
    let ph: number;
    if (c.frozenMag) {
      // la fase avanza della frequenza centrale della banda, con un po' di caso
      ph = c.phase[k]! + (2 * Math.PI * k * HOP) / N + (rand() - 0.5) * 0.6;
    } else ph = Math.atan2(c.im[k]!, c.re[k]!);
    c.phase[k] = ph;
    const a = src[k]! * binGain(k, s);
    c.re[k] = a * Math.cos(ph);
    c.im[k] = a * Math.sin(ph);
    if (k > 0 && k < N / 2) {
      c.re[N - k] = c.re[k]!;
      c.im[N - k] = -c.im[k]!;
    }
  }
  c.im[0] = 0;
  c.im[N / 2] = 0;
}

export const spectral: ModuleDefinition = {
  manifest: {
    id: 'spectral',
    name: 'Spettrale',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'freeze', label: 'Freeze', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'smear', label: 'Smear', min: 0, max: 0.98, default: 0.3, kind: 'continuous' },
      { id: 'blur', label: 'Blur', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'tilt', label: 'Tilt', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'lowCut', label: 'Taglio basso', min: 20, max: 5000, default: 20, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'highCut', label: 'Taglio alto', min: 200, max: 22000, default: 22000, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const chans: Chan[] = [];
    /** Il segnale secco, ritardato come quello elaborato (per il mix senza sfasamenti). */
    const dryLines: Float32Array[] = [];
    let dw = 0;
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const n = Math.min(2, input?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        while (chans.length < n) {
          chans.push(chan());
          dryLines.push(new Float32Array(N));
        }
        const sr = ctx.sampleRate;
        const s: SpectralSettings = {
          freeze: ctx.discrete('freeze', 0) === 1,
          smear: ctx.param('smear'),
          blur: ctx.param('blur'),
          tilt: ctx.param('tilt'),
          lowBin: Math.floor((ctx.param('lowCut') / sr) * N),
          highBin: Math.ceil((ctx.param('highCut') / sr) * N),
        };
        const mix = ctx.param('mix');
        const rand = () => ctx.rng.float();
        let w = dw;
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const c = chans[v]!;
          const dl = dryLines[v]!;
          const o = out[v]!;
          w = dw;
          for (let i = 0; i < ctx.frames; i++) {
            const xin = x ? x[i]! : 0;
            c.inBuf[c.iw] = xin;
            c.iw = c.iw + 1 === N ? 0 : c.iw + 1;
            const dry = dl[w]!;
            dl[w] = xin;
            w = w + 1 === N ? 0 : w + 1;
            // uscita: il buffer di sovrapposizione
            const wet = c.outBuf[c.rd]!;
            c.outBuf[c.rd] = 0;
            c.rd = c.rd + 1 === N ? 0 : c.rd + 1;
            o[i] = dry * (1 - mix) + wet * mix;
            if (++c.count >= HOP) {
              c.count = 0;
              for (let k = 0; k < N; k++) {
                c.re[k] = c.inBuf[(c.iw + k) % N]! * HANN[k]!;
                c.im[k] = 0;
              }
              fft(c.re, c.im);
              processFrame(c, s, rand);
              fft(c.re, c.im, true);
              // somma nel buffer d'uscita a partire dalla lettura attuale
              for (let k = 0; k < N; k++) {
                const j = (c.rd + k) % N;
                c.outBuf[j]! += c.re[k]! * HANN[k]! * OLA;
              }
            }
          }
        }
        dw = w;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default spectral;
