/**
 * Dinamica — tre modi:
 *   compressore  sopra la soglia il livello cresce di 1/ratio (ginocchio morbido)
 *   limiter      nessun picco sopra la soglia: 2 ms di anticipo e ratio infinito
 *   duck         il segnale si abbassa quando suona il sidechain (`side`),
 *                di `depth`: la cassa che fa spazio al resto
 * Il rivelatore legge `side` se è collegato, altrimenti l'ingresso. `gr` è la
 * riduzione di guadagno (0 = niente, 1 = tutto), per la view o per modulare.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const DYN_MODES = ['compressore', 'limiter', 'duck'] as const;

/** Livello d'uscita (dB) per un livello d'ingresso (dB): la curva del compressore. */
export function transfer(inDb: number, threshold: number, ratio: number, knee: number): number {
  const over = inDb - threshold;
  if (2 * over < -knee) return inDb;
  if (2 * Math.abs(over) <= knee) return inDb + ((1 / ratio - 1) * (over + knee / 2) ** 2) / (2 * knee);
  return threshold + over / ratio;
}

const LOOKAHEAD = 0.002;

export const dynamics: ModuleDefinition = {
  manifest: {
    id: 'dynamics',
    name: 'Dinamica',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'side', type: 'audio', poly: true },
    ],
    outputs: [
      { id: 'out', type: 'audio', poly: true },
      { id: 'gr', type: 'audio' },
    ],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: [...DYN_MODES] },
      { id: 'threshold', label: 'Soglia', min: -60, max: 0, default: -18, kind: 'continuous', unit: 'dB' },
      { id: 'ratio', label: 'Rapporto', min: 1, max: 20, default: 4, kind: 'continuous', curve: 'exp' },
      { id: 'attack', label: 'Attacco', min: 0.0005, max: 0.2, default: 0.01, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'release', label: 'Rilascio', min: 0.01, max: 2, default: 0.15, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'depth', label: 'Profondità duck', min: 0, max: 1, default: 0.7, kind: 'continuous' },
      { id: 'makeup', label: 'Guadagno', min: -12, max: 24, default: 0, kind: 'continuous', unit: 'dB' },
    ],
    seeded: false,
  },
  create() {
    let env = 0;
    let gain = 1;
    let delays: Float32Array[] = [];
    let dw = 0;
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const sideIn = inputs.audio('side');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        const grOut = outputs.audio('gr').channels[0]!;
        const sr = ctx.sampleRate;
        const mode = ctx.discrete('mode', 0);
        const la = mode === 1 ? Math.round(LOOKAHEAD * sr) : 0;
        if (delays.length !== n || (delays[0]?.length ?? 0) !== la + 1) {
          delays = Array.from({ length: n }, () => new Float32Array(la + 1));
          dw = 0;
        }
        const thr = ctx.param('threshold');
        const ratio = mode === 1 ? 1000 : ctx.param('ratio');
        const atk = 1 - Math.exp(-1 / ((mode === 1 ? LOOKAHEAD / 3 : ctx.param('attack')) * sr));
        const rel = 1 - Math.exp(-1 / (ctx.param('release') * sr));
        const depth = ctx.param('depth');
        const makeup = Math.pow(10, ctx.param('makeup') / 20);
        const det = sideIn ?? input;
        for (let i = 0; i < ctx.frames; i++) {
          // rivelatore di picco sulla voce più forte
          let peak = 0;
          if (det) for (const ch of det.channels) peak = Math.max(peak, Math.abs(ch[i]!));
          env += (peak - env) * (peak > env ? atk : rel);
          let target: number;
          if (mode === 2) target = 1 - depth * Math.min(1, env * 2);
          else {
            const inDb = 20 * Math.log10(Math.max(1e-6, env));
            target = Math.pow(10, (transfer(inDb, thr, ratio, mode === 1 ? 0.5 : 6) - inDb) / 20);
          }
          // il guadagno scende con l'attacco del rivelatore e risale con il rilascio
          gain += (target - gain) * (target < gain ? (mode === 1 ? 1 : atk) : rel);
          grOut[i] = 1 - gain;
          for (let v = 0; v < n; v++) {
            const x = channel(input, v);
            const d = delays[v]!;
            d[dw] = x ? x[i]! : 0;
            const delayed = d[(dw + 1) % d.length]!;
            out[v]![i] = delayed * gain * makeup;
          }
          dw = (dw + 1) % (la + 1);
        }
        if (!Number.isFinite(env)) env = 0;
        if (!Number.isFinite(gain)) gain = 1;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default dynamics;
