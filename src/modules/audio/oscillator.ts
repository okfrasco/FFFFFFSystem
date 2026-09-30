/**
 * Oscillatore — sine, triangolo, dente di sega e quadra/impulso (con
 * polyBLEP contro l'aliasing). L'altezza viene dall'ingresso `pitch` (nota
 * MIDI per voce, es. da Voci) o dal parametro; `pm` è modulazione di fase
 * da un altro segnale audio (FM "alla DX").
 */

import { channel, mtof, polyBlep } from '../../core/dsp';
import type { ModuleDefinition } from '../../core/types';

const TAU = 2 * Math.PI;

export const oscillator: ModuleDefinition = {
  manifest: {
    id: 'oscillator',
    name: 'Oscillatore',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'pitch', type: 'audio', poly: true },
      { id: 'pm', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'wave', label: 'Forma', min: 0, max: 3, default: 2, kind: 'discrete', options: ['sine', 'triangolo', 'saw', 'quadra'] },
      { id: 'pitch', label: 'Nota', min: 0, max: 127, default: 48, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -48, max: 48, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'fine', label: 'Fine', min: -100, max: 100, default: 0, kind: 'continuous', unit: 'ct' },
      { id: 'pw', label: 'Larghezza', min: 0.05, max: 0.95, default: 0.5, kind: 'continuous' },
      { id: 'pm', label: 'PM', min: 0, max: 2, default: 0, kind: 'continuous' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    let phase: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const pitchIn = inputs.audio('pitch');
        const pmIn = inputs.audio('pm');
        const n = pitchIn?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (phase.length < n) phase.push(0);
        const wave = ctx.discrete('wave', 0);
        const offset = ctx.param('transpose') + ctx.param('fine') / 100;
        const base = ctx.param('pitch');
        const pw = ctx.param('pw');
        const pmAmt = ctx.param('pm');
        const level = ctx.param('level');
        const sr = ctx.sampleRate;
        for (let v = 0; v < n; v++) {
          const pin = channel(pitchIn, v);
          const pm = pmAmt > 0 ? channel(pmIn, v) : undefined;
          const o = out[v]!;
          let ph = phase[v]!;
          let dt = mtof(base + offset) / sr;
          let lastNote = NaN;
          for (let i = 0; i < ctx.frames; i++) {
            if (pin) {
              const note = pin[i]! + offset;
              if (note !== lastNote) {
                lastNote = note;
                dt = mtof(note) / sr;
              }
            }
            ph += dt;
            ph -= Math.floor(ph);
            let p = ph;
            if (pm) {
              p += pmAmt * pm[i]!;
              p -= Math.floor(p);
            }
            let y: number;
            switch (wave) {
              case 0:
                y = Math.sin(TAU * p);
                break;
              case 1:
                y = 1 - 4 * Math.abs(p - 0.5);
                break;
              case 2:
                y = 2 * p - 1 - polyBlep(p, dt);
                break;
              default: {
                y = p < pw ? 1 : -1;
                y += polyBlep(p, dt);
                const q = p - pw + (p < pw ? 1 : 0);
                y -= polyBlep(q, dt);
              }
            }
            o[i] = y * level;
          }
          phase[v] = ph;
        }
      },
      getState: () => ({ phase: [...phase] }),
      setState(state) {
        phase = [...(state as { phase: number[] }).phase];
      },
    };
  },
};
