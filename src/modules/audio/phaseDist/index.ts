/**
 * Phase Distortion — la sintesi dei Casio CZ: un coseno letto con una fase
 * piegata. Con `amount` a 0 è un seno puro; salendo la piega si stringe e
 * il suono si apre, come un filtro senza filtro (`mod` lo muove con un
 * inviluppo, al campione). Le forme "risonanti" moltiplicano la frequenza
 * dentro una finestra: il picco risonante dei CZ.
 */

import { channel, mtof } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const PD_SHAPES = ['saw', 'quadra', 'impulso', 'doppio seno', 'risonante saw', 'risonante triangolo', 'risonante trapezio'] as const;

/** Un campione di forma `shape` alla fase p (0–1) con piega `a` (0–1). */
export function pdSample(shape: number, p: number, a: number): number {
  const TAU = 2 * Math.PI;
  switch (shape) {
    case 0: {
      const d = 0.5 - 0.49 * a;
      const q = p < d ? (p * 0.5) / d : 0.5 + ((p - d) * 0.5) / (1 - d);
      return Math.cos(TAU * q);
    }
    case 1: {
      const w = 1 - 0.97 * a;
      const h = p < 0.5 ? 0 : 0.5;
      const q = h + 0.5 * Math.min(1, (p - h) / 0.5 / w);
      return Math.cos(TAU * q);
    }
    case 2: {
      const w = 1 - 0.95 * a;
      return Math.cos(TAU * Math.min(1, p / w));
    }
    case 3: {
      const d = 0.5 - 0.49 * a;
      const p2 = (2 * p) % 1;
      const q = p2 < d ? (p2 * 0.5) / d : 0.5 + ((p2 - d) * 0.5) / (1 - d);
      return Math.cos(TAU * q);
    }
    default: {
      const m = 1 + a * 15;
      const win = shape === 4 ? 1 - p : shape === 5 ? 1 - Math.abs(2 * p - 1) : Math.min(1, 2 * (1 - p));
      // coseno a frequenza moltiplicata dentro la finestra: il salto a fine ciclo è il carattere dei CZ
      return -win * Math.cos(TAU * m * p);
    }
  }
}

export const phaseDist: ModuleDefinition = {
  manifest: {
    id: 'phaseDist',
    name: 'Phase Distortion',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'pitch', type: 'audio', poly: true },
      { id: 'mod', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'shape', label: 'Forma', min: 0, max: PD_SHAPES.length - 1, default: 0, kind: 'discrete', options: [...PD_SHAPES] },
      { id: 'amount', label: 'Piega (DCW)', min: 0, max: 1, default: 0.4, kind: 'continuous' },
      { id: 'modDepth', label: 'Mod', min: -1, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'pitch', label: 'Nota', min: 0, max: 127, default: 48, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -48, max: 48, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const phase: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const pitchIn = inputs.audio('pitch');
        const modIn = inputs.audio('mod');
        const n = pitchIn?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (phase.length < n) phase.push(0);
        const shape = ctx.discrete('shape', 0);
        const amount = ctx.param('amount');
        const depth = ctx.param('modDepth');
        const tr = ctx.param('transpose');
        const base = ctx.param('pitch');
        const level = ctx.param('level');
        const sr = ctx.sampleRate;
        for (let v = 0; v < n; v++) {
          const pin = channel(pitchIn, v);
          const m = channel(modIn, v);
          const o = out[v]!;
          let ph = phase[v]!;
          let last = NaN;
          let dt = mtof(base + tr) / sr;
          for (let i = 0; i < ctx.frames; i++) {
            if (pin && pin[i] !== last) {
              last = pin[i]!;
              dt = mtof(last + tr) / sr;
            }
            ph += dt;
            ph -= Math.floor(ph);
            const a = Math.max(0, Math.min(1, amount + (m ? depth * m[i]! : 0)));
            o[i] = pdSample(shape, ph, a) * level;
          }
          phase[v] = ph;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default phaseDist;
