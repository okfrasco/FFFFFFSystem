/**
 * Additivo — fino a 64 parziali sinusoidali per voce, con le ampiezze
 * disegnate nel nodo (una barra per parziale) e tre controlli globali:
 * `tilt` inclina lo spettro (più scuro / più brillante), `oddEven` spegne
 * le pari o le dispari, `stretch` allarga le parziali (f_n = f·n^(1+stretch),
 * suoni di campana e di metallo). Le parziali sopra Nyquist si tacciono.
 *
 * Ogni parziale è un oscillatore a rotazione (coseno e seno ruotati di un
 * angolo fisso a ogni campione): quattro moltiplicazioni, niente seni. La
 * frequenza si aggiorna a ogni blocco.
 */

import { channel, mtof } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const MAX_PARTIALS = 64;

export interface AdditiveConfig {
  amps: number[];
}

/** Ampiezza effettiva della parziale n (1…) dai punti disegnati e dai controlli. */
export function partialAmp(amps: readonly number[], n: number, tilt: number, oddEven: number): number {
  const a = amps[n - 1] ?? 0;
  if (a <= 0) return 0;
  const t = Math.pow(n, -2 * tilt);
  const oe = n === 1 ? 1 : n % 2 ? Math.min(1, 1 - oddEven) : Math.min(1, 1 + oddEven);
  return a * t * oe;
}

export const partialRatio = (n: number, stretch: number) => Math.pow(n, 1 + stretch);

export const additive: ModuleDefinition = {
  manifest: {
    id: 'additive',
    name: 'Additivo',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'pitch', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'partials', label: 'Parziali', min: 1, max: MAX_PARTIALS, default: 24, kind: 'discrete' },
      { id: 'tilt', label: 'Inclinazione', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'oddEven', label: 'Dispari ↔ pari', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'stretch', label: 'Stiramento', min: -0.1, max: 0.2, default: 0, kind: 'continuous' },
      { id: 'pitch', label: 'Nota', min: 0, max: 127, default: 48, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -48, max: 48, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: { amps: Array.from({ length: 32 }, (_, i) => +(1 / (i + 1)).toFixed(3)) } satisfies AdditiveConfig,
  create(init) {
    let cfg = init.config as AdditiveConfig;
    const cosv: Float64Array[] = [];
    const sinv: Float64Array[] = [];
    const gains: Float64Array[] = [];
    return {
      process(ctx, inputs, outputs) {
        const pitchIn = inputs.audio('pitch');
        const n = pitchIn?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (cosv.length < n) {
          cosv.push(new Float64Array(MAX_PARTIALS).fill(1));
          sinv.push(new Float64Array(MAX_PARTIALS));
          gains.push(new Float64Array(MAX_PARTIALS));
        }
        const count = ctx.discrete('partials', 0);
        const tilt = ctx.param('tilt');
        const oe = ctx.param('oddEven');
        const stretch = ctx.param('stretch');
        const offset = ctx.param('transpose');
        const base = ctx.param('pitch');
        const level = ctx.param('level');
        const sr = ctx.sampleRate;
        const amp = new Float64Array(count);
        const ratio = new Float64Array(count);
        let norm = 0;
        for (let k = 0; k < count; k++) {
          amp[k] = partialAmp(cfg.amps, k + 1, tilt, oe);
          ratio[k] = partialRatio(k + 1, stretch);
          norm += amp[k]!;
        }
        const scale = norm > 0 ? level / Math.max(1, norm) : 0;
        for (let v = 0; v < n; v++) {
          const pin = channel(pitchIn, v);
          const f = mtof((pin ? pin[ctx.frames >> 1]! : base) + offset);
          const cs = cosv[v]!;
          const sn = sinv[v]!;
          const gn = gains[v]!;
          const o = out[v]!;
          o.fill(0);
          for (let k = 0; k < count; k++) {
            // ampiezza verso il valore nuovo in un blocco (niente click); zero sopra Nyquist
            const target = f * ratio[k]! < 0.45 * sr ? amp[k]! * scale : 0;
            const g0 = gn[k]!;
            if (g0 === 0 && target === 0) continue;
            const dg = (target - g0) / ctx.frames;
            const w = (2 * Math.PI * f * ratio[k]!) / sr;
            const cw = Math.cos(w);
            const sw = Math.sin(w);
            let c = cs[k]!;
            let s = sn[k]!;
            let g = g0;
            for (let i = 0; i < ctx.frames; i++) {
              const nc = c * cw - s * sw;
              s = c * sw + s * cw;
              c = nc;
              g += dg;
              o[i]! += s * g;
            }
            // la rotazione accumula errori: si riporta sul cerchio a ogni blocco
            const r = 1 / Math.hypot(c, s);
            cs[k] = c * r;
            sn[k] = s * r;
            gn[k] = target;
          }
        }
      },
      setConfig(c) {
        cfg = c as AdditiveConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default additive;
