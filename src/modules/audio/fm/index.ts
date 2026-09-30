/**
 * FM — quattro operatori sinusoidali, ognuno con rapporto di frequenza,
 * scarto in Hz, inviluppo ADSR e livello d'uscita. Chi modula chi sta in una
 * matrice di parametri: m{i}_{j} è quanto l'operatore j modula la fase
 * dell'operatore i; la diagonale è il feedback. Tutto modulabile e
 * morphabile, quindi l'algoritmo stesso può cambiare mentre suona.
 * Ogni modulazione legge l'uscita del campione prima: qualunque matrice
 * funziona, anche con cicli.
 * Ingressi da Voci: pitch, gate, vel (senza gate l'FM suona di continuo).
 */

import { channel, fastSin, mtof } from '../../../core/dsp';
import type { ModuleDefinition, ParamSpec } from '../../../core/types';

export const OPS = 4;
export const mId = (i: number, j: number) => `m${i + 1}_${j + 1}`;

const RATIOS = [1, 1, 2, 3.5];
const OUTS = [1, 0, 0.5, 0];
const MATRIX: Record<string, number> = { m1_2: 0.45, m2_2: 0.15, m3_4: 0.3 };

const params: ParamSpec[] = [];
for (let k = 1; k <= OPS; k++) {
  params.push(
    { id: `r${k}`, label: `Rapporto ${k}`, min: 0.25, max: 16, default: RATIOS[k - 1]!, kind: 'continuous', curve: 'exp' },
    { id: `hz${k}`, label: `Scarto ${k}`, min: -20, max: 20, default: 0, kind: 'continuous', unit: 'Hz' },
    { id: `o${k}`, label: `Uscita ${k}`, min: 0, max: 1, default: OUTS[k - 1]!, kind: 'continuous' },
    { id: `a${k}`, label: `Attacco ${k}`, min: 0.001, max: 5, default: 0.003, kind: 'continuous', curve: 'exp', unit: 's' },
    { id: `d${k}`, label: `Decay ${k}`, min: 0.005, max: 10, default: k === 1 ? 1.2 : 0.4 + 0.3 * k, kind: 'continuous', curve: 'exp', unit: 's' },
    { id: `s${k}`, label: `Sustain ${k}`, min: 0, max: 1, default: k === 1 ? 0.6 : 0.3, kind: 'continuous' },
    { id: `rl${k}`, label: `Rilascio ${k}`, min: 0.005, max: 10, default: 0.4, kind: 'continuous', curve: 'exp', unit: 's' },
  );
}
for (let i = 0; i < OPS; i++) {
  for (let j = 0; j < OPS; j++) params.push({ id: mId(i, j), label: `${j + 1} → ${i + 1}`, min: 0, max: 1, default: MATRIX[mId(i, j)] ?? 0, kind: 'continuous' });
}
params.push(
  { id: 'pitch', label: 'Nota', min: 0, max: 127, default: 48, kind: 'continuous' },
  { id: 'transpose', label: 'Trasponi', min: -48, max: 48, default: 0, kind: 'discrete', unit: 'st' },
  { id: 'velSens', label: 'Velocity', min: 0, max: 1, default: 0.7, kind: 'continuous' },
  { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
);

/** Quanti cicli di fase sposta una modulazione a 1 per un'uscita a 1 (indice ~ 12 radianti). */
const INDEX = 2;

interface Voice {
  ph: Float64Array;
  y: Float64Array;
  y1: Float64Array;
  env: Float64Array;
  /** 0 spento, 1 attacco, 2 decay/sustain, 3 rilascio. */
  stage: Uint8Array;
  gate: boolean;
}

const newVoice = (): Voice => ({
  ph: new Float64Array(OPS),
  y: new Float64Array(OPS),
  y1: new Float64Array(OPS),
  env: new Float64Array(OPS),
  stage: new Uint8Array(OPS),
  gate: false,
});

export const fm: ModuleDefinition = {
  manifest: {
    id: 'fm',
    name: 'FM',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'pitch', type: 'audio', poly: true },
      { id: 'gate', type: 'audio', poly: true },
      { id: 'vel', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params,
    seeded: false,
  },
  create() {
    const voices: Voice[] = [];
    return {
      process(ctx, inputs, outputs) {
        const pitchIn = inputs.audio('pitch');
        const gateIn = inputs.audio('gate');
        const velIn = inputs.audio('vel');
        const n = Math.max(pitchIn?.channels.length ?? 1, gateIn?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        while (voices.length < n) voices.push(newVoice());
        const sr = ctx.sampleRate;
        const ratio = new Float64Array(OPS);
        const hz = new Float64Array(OPS);
        const outLv = new Float64Array(OPS);
        const atk = new Float64Array(OPS);
        const dec = new Float64Array(OPS);
        const sus = new Float64Array(OPS);
        const rel = new Float64Array(OPS);
        const m = new Float64Array(OPS * OPS);
        for (let k = 0; k < OPS; k++) {
          ratio[k] = ctx.param(`r${k + 1}`);
          hz[k] = ctx.param(`hz${k + 1}`);
          outLv[k] = ctx.param(`o${k + 1}`);
          atk[k] = 1 / (ctx.param(`a${k + 1}`) * sr);
          dec[k] = 1 - Math.exp(-4.6 / (ctx.param(`d${k + 1}`) * sr));
          sus[k] = ctx.param(`s${k + 1}`);
          rel[k] = 1 - Math.exp(-4.6 / (ctx.param(`rl${k + 1}`) * sr));
          for (let j = 0; j < OPS; j++) m[k * OPS + j] = ctx.param(mId(k, j)) * INDEX;
        }
        const offset = ctx.param('transpose');
        const base = ctx.param('pitch');
        const velSens = ctx.param('velSens');
        const level = ctx.param('level');
        const drone = !gateIn;
        for (let v = 0; v < n; v++) {
          const vo = voices[v]!;
          const pin = channel(pitchIn, v);
          const gin = channel(gateIn, v);
          const vin = channel(velIn, v);
          const o = out[v]!;
          let f0 = mtof(base + offset);
          let last = NaN;
          for (let i = 0; i < ctx.frames; i++) {
            if (pin && pin[i] !== last) {
              last = pin[i]!;
              f0 = mtof(last + offset);
            }
            const g = drone || (gin ? gin[i]! > 0.5 : false);
            if (g && !vo.gate) vo.stage.fill(1);
            else if (!g && vo.gate) for (let k = 0; k < OPS; k++) if (vo.stage[k]) vo.stage[k] = 3;
            vo.gate = g;
            const vel = 1 - velSens + velSens * (vin ? vin[i]! : 1);
            let sum = 0;
            for (let k = 0; k < OPS; k++) {
              // inviluppo
              let e = vo.env[k]!;
              switch (vo.stage[k]) {
                case 1:
                  e += atk[k]!;
                  if (e >= 1) {
                    e = 1;
                    vo.stage[k] = 2;
                  }
                  break;
                case 2:
                  e += (sus[k]! - e) * dec[k]!;
                  break;
                case 3:
                  e -= e * rel[k]!;
                  if (e < 1e-5) {
                    e = 0;
                    vo.stage[k] = 0;
                  }
                  break;
              }
              vo.env[k] = e;
              // fase modulata dalle uscite del campione prima (la diagonale mediata: feedback stabile)
              let mod = 0;
              for (let j = 0; j < OPS; j++) {
                const mm = m[k * OPS + j]!;
                if (mm) mod += mm * (j === k ? 0.5 * (vo.y[j]! + vo.y1[j]!) : vo.y[j]!);
              }
              let ph = vo.ph[k]! + (f0 * ratio[k]! + hz[k]!) / sr;
              ph -= Math.floor(ph);
              vo.ph[k] = ph;
              const y = fastSin(ph + mod) * e * vel;
              vo.y1[k] = vo.y[k]!;
              vo.y[k] = y;
              sum += y * outLv[k]!;
            }
            o[i] = sum * level;
          }
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default fm;
