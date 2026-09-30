/**
 * Karplus-Strong — corde pizzicate e percussioni: un colpo di rumore entra in
 * una linea di ritardo lunga un periodo, che si richiude su se stessa
 * attraverso un filtro passa-basso. Riceve le note direttamente e le
 * distribuisce sulle sue voci (la più vecchia viene rubata).
 *
 *   decay       tempo di smorzamento (T60) della corda che suona
 *   brightness  quanto la corda resta brillante (il filtro nel giro)
 *   pick        posizione del pizzico: vicino al ponte (0) è più tagliente
 *   release     smorzamento dopo la fine della nota (la mano che ferma la corda)
 */

import { framedEvents, mtof } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

const MAX_DELAY = 4096; // campioni: basta fino a ~12 Hz a 48 kHz

interface KsVoice {
  buf: Float32Array;
  w: number;
  period: number;
  lp: number;
  offAt: number;
  age: number;
  active: boolean;
  /** Campioni silenziosi di fila: dopo due periodi la voce torna libera. */
  quiet: number;
}

/** Guadagno per giro che dà un T60 di `t60` secondi alla frequenza `f`. */
export function loopGain(f: number, t60: number): number {
  return Math.pow(10, -3 / (Math.max(1, f) * Math.max(0.01, t60)));
}

export const karplus: ModuleDefinition = {
  manifest: {
    id: 'karplus',
    name: 'Karplus-Strong',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'note', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'audio' }],
    params: [
      { id: 'voices', label: 'Voci', min: 1, max: 12, default: 6, kind: 'discrete' },
      { id: 'decay', label: 'Decadimento', min: 0.05, max: 20, default: 3, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'brightness', label: 'Brillantezza', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'pick', label: 'Pizzico', min: 0, max: 0.5, default: 0.12, kind: 'continuous' },
      { id: 'release', label: 'Rilascio', min: 0.02, max: 20, default: 20, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'pitch', label: 'Nota trig', min: 24, max: 96, default: 60, kind: 'discrete' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.6, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    let voices: KsVoice[] = [];
    let counter = 0;
    return {
      process(ctx, inputs, outputs) {
        const sr = ctx.sampleRate;
        const nv = ctx.discrete('voices', 0);
        while (voices.length < nv) voices.push({ buf: new Float32Array(MAX_DELAY), w: 0, period: 100, lp: 0, offAt: Infinity, age: 0, active: false, quiet: 0 });
        const out = outputs.audio('out').channels[0]!;
        out.fill(0);
        const events = framedEvents(ctx, inputs.control('note')?.events ?? []);
        const decay = ctx.param('decay');
        const release = ctx.param('release');
        const bright = ctx.param('brightness');
        // filtro nel giro (un polo): da scuro a quasi passante; il suo ritardo, in
        // campioni, si toglie dalla linea perché la nota resti intonata
        const coef = 0.5 + 0.5 * bright * bright;
        const filterDelay = (1 - coef) / coef;
        const pick = ctx.param('pick');
        const level = ctx.param('level');
        const rng = ctx.rng;
        let ei = 0;
        for (let i = 0; i < ctx.frames; i++) {
          const t = ctx.t0 + i / sr;
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind === 'gate' && !e.on) continue;
            const note = e.kind === 'note' ? e.pitch : e.kind === 'trig' ? (e.value ?? ctx.param('pitch')) : ctx.param('pitch');
            const vel = e.kind === 'gate' ? 1 : e.vel;
            let k = -1;
            for (let j = 0; j < nv; j++) if (!voices[j]!.active && (k < 0 || voices[j]!.age < voices[k]!.age)) k = j;
            if (k < 0) for (let j = 0; j < nv; j++) if (k < 0 || voices[j]!.age < voices[k]!.age) k = j;
            const vo = voices[k]!;
            vo.period = Math.max(2, Math.min(MAX_DELAY - 2, sr / mtof(note) - filterDelay));
            vo.quiet = 0;
            vo.active = true;
            vo.age = ++counter;
            vo.offAt = e.kind === 'note' ? t + e.dur : Infinity;
            vo.lp = 0;
            // il colpo: rumore, meno sé stesso ritardato della posizione del pizzico
            const len = Math.ceil(vo.period);
            const pickDelay = Math.max(1, Math.round(pick * len));
            const burst = new Float32Array(len);
            for (let n = 0; n < len; n++) burst[n] = (rng.float() * 2 - 1) * vel;
            for (let n = 0; n < len; n++) {
              const d = n - pickDelay >= 0 ? burst[n - pickDelay]! : 0;
              vo.buf[(vo.w - len + n + MAX_DELAY) % MAX_DELAY] = (burst[n]! - d) * 0.7;
            }
          }
          let sum = 0;
          for (let j = 0; j < nv; j++) {
            const vo = voices[j]!;
            if (!vo.active) continue;
            const f = sr / (vo.period + filterDelay);
            const g = loopGain(f, t >= vo.offAt ? Math.min(decay, release) : decay);
            // lettura frazionaria un periodo indietro
            let r = vo.w - vo.period;
            if (r < 0) r += MAX_DELAY;
            const r0 = Math.floor(r);
            const fr = r - r0;
            const a = vo.buf[r0 % MAX_DELAY]!;
            const b = vo.buf[(r0 + 1) % MAX_DELAY]!;
            const y = a + (b - a) * fr;
            vo.lp = vo.lp + (y - vo.lp) * coef;
            const next = vo.lp * g;
            vo.buf[vo.w] = next;
            vo.w = (vo.w + 1) % MAX_DELAY;
            sum += y;
            vo.quiet = Math.abs(y) < 1e-5 ? vo.quiet + 1 : 0;
            if (vo.quiet > 2 * vo.period) vo.active = false;
          }
          out[i] = sum * level;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default karplus;
