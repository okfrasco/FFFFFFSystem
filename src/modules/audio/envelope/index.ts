/**
 * Inviluppo ADSR per voce, pilotato da un gate audio (es. da Voci).
 * Attacco lineare dal livello corrente (niente click sui retrigger),
 * decadimento e rilascio esponenziali (i tempi sono fino a −60 dB).
 * `velocity` scala l'uscita con la velocity della voce.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

const IDLE = 0;
const ATTACK = 1;
const DECAY = 2;
const SUSTAIN = 3;
const RELEASE = 4;

interface EnvState {
  stage: number[];
  level: number[];
  prev: boolean[];
}

const coefFor = (seconds: number, sr: number) => Math.exp(-6.9 / (Math.max(1e-4, seconds) * sr));

export const envelope: ModuleDefinition = {
  manifest: {
    id: 'envelope',
    name: 'Inviluppo',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'gate', type: 'audio', poly: true },
      { id: 'vel', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'attack', label: 'Attacco', min: 0.001, max: 10, default: 0.005, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'decay', label: 'Decadimento', min: 0.001, max: 10, default: 0.25, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'release', label: 'Rilascio', min: 0.001, max: 10, default: 0.3, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'velocity', label: 'Velocity', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    let s: EnvState = { stage: [], level: [], prev: [] };
    return {
      process(ctx, inputs, outputs) {
        const gateIn = inputs.audio('gate');
        const velIn = inputs.audio('vel');
        const n = gateIn?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (s.stage.length < n) {
          s.stage.push(IDLE);
          s.level.push(0);
          s.prev.push(false);
        }
        const sr = ctx.sampleRate;
        const attInc = 1 / (Math.max(1e-4, ctx.param('attack')) * sr);
        const decCoef = coefFor(ctx.param('decay'), sr);
        const relCoef = coefFor(ctx.param('release'), sr);
        const sus = ctx.param('sustain');
        const velAmt = ctx.param('velocity');
        for (let v = 0; v < n; v++) {
          const g = channel(gateIn, v);
          const vel = channel(velIn, v);
          const o = out[v]!;
          let stage = s.stage[v]!;
          let level = s.level[v]!;
          let prev = s.prev[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            const on = g ? g[i]! >= 0.5 : false;
            if (on && !prev) stage = ATTACK;
            else if (!on && prev && stage !== IDLE) stage = RELEASE;
            prev = on;
            switch (stage) {
              case ATTACK:
                level += attInc;
                if (level >= 1) {
                  level = 1;
                  stage = DECAY;
                }
                break;
              case DECAY:
                level = sus + (level - sus) * decCoef;
                if (Math.abs(level - sus) < 1e-4) stage = SUSTAIN;
                break;
              case SUSTAIN:
                level = sus;
                break;
              case RELEASE:
                level *= relCoef;
                if (level < 1e-5) {
                  level = 0;
                  stage = IDLE;
                }
                break;
            }
            o[i] = level * (vel ? 1 - velAmt + velAmt * vel[i]! : 1);
          }
          s.stage[v] = stage;
          s.level[v] = level;
          s.prev[v] = prev;
        }
      },
      getState: () => ({ stage: [...s.stage], level: [...s.level], prev: [...s.prev] }),
      setState(state) {
        const st = state as EnvState;
        s = { stage: [...st.stage], level: [...st.level], prev: [...st.prev] };
      },
    };
  },
};

export default envelope;
