/**
 * Voci — trasforma note ed eventi in N voci: per ogni voce un segnale di
 * altezza (nota MIDI, anche frazionaria), un gate e la velocity, al campione.
 *
 * Una nota occupa la voce libera da più tempo, o ruba la più vecchia; se la
 * voce era accesa il gate scende per un campione, così l'inviluppo riparte.
 * Un trigger senza durata dura `length`; il suo `value`, se c'è, è la nota.
 * Glide: portamento esponenziale verso la nota nuova (utile con 1 voce).
 * Legato: una nota che ruba una voce ancora accesa non riapre il gate
 * (niente retrigger dell'inviluppo): con 1 voce e un po' di glide è lo slide
 * della 303.
 */

import { framedEvents, onePole } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

interface VoicesState {
  pitch: number[];
  target: number[];
  gate: boolean[];
  vel: number[];
  offAt: number[];
  age: number[];
  counter: number;
}

const initial = (): VoicesState => ({ pitch: [], target: [], gate: [], vel: [], offAt: [], age: [], counter: 0 });

export const voices: ModuleDefinition = {
  manifest: {
    id: 'voices',
    name: 'Voci',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'note', type: 'control', signal: 'event', poly: true }],
    outputs: [
      { id: 'pitch', type: 'audio', poly: true },
      { id: 'gate', type: 'audio', poly: true },
      { id: 'vel', type: 'audio', poly: true },
    ],
    params: [
      { id: 'voices', label: 'Voci', min: 1, max: 16, default: 8, kind: 'discrete' },
      { id: 'glide', label: 'Glide', min: 0, max: 1, default: 0, kind: 'continuous', unit: 's' },
      { id: 'length', label: 'Durata trig', min: 0.01, max: 4, default: 0.2, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'pitch', label: 'Nota trig', min: 0, max: 127, default: 60, kind: 'discrete' },
      { id: 'legato', label: 'Legato', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
    ],
    seeded: false,
  },

  create() {
    let s = initial();
    return {
      process(ctx, inputs, outputs) {
        const n = ctx.discrete('voices', 0);
        while (s.pitch.length < n) {
          s.pitch.push(60);
          s.target.push(60);
          s.gate.push(false);
          s.vel.push(0);
          s.offAt.push(Infinity);
          s.age.push(0);
        }
        const pitchOut = outputs.audio('pitch', n).channels;
        const gateOut = outputs.audio('gate', n).channels;
        const velOut = outputs.audio('vel', n).channels;
        const events = framedEvents(ctx, inputs.control('note')?.events ?? []);
        const glide = ctx.param('glide');
        const coef = glide > 0 ? onePole(glide / 3, ctx.sampleRate) : 1;
        const retrig = new Array<boolean>(n).fill(false);
        let ei = 0;

        for (let i = 0; i < ctx.frames; i++) {
          const t = ctx.t0 + i / ctx.sampleRate;
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind === 'gate' && !e.on) {
              // chiude la voce accesa più di recente
              let best = -1;
              for (let v = 0; v < n; v++) if (s.gate[v] && (best < 0 || s.age[v]! > s.age[best]!)) best = v;
              if (best >= 0) s.offAt[best] = t;
              continue;
            }
            const note = e.kind === 'note' ? e.pitch : e.kind === 'trig' ? (e.value ?? ctx.param('pitch')) : ctx.param('pitch');
            const dur = e.kind === 'note' ? e.dur : e.kind === 'trig' ? ctx.param('length') : Infinity;
            let v = -1;
            for (let k = 0; k < n; k++) if (!s.gate[k] && (v < 0 || s.age[k]! < s.age[v]!)) v = k;
            if (v < 0) for (let k = 0; k < n; k++) if (v < 0 || s.age[k]! < s.age[v]!) v = k;
            retrig[v] = s.gate[v]! && ctx.discrete('legato', s.counter) === 0;
            if (coef >= 1 || !s.gate[v] && n > 1) s.pitch[v] = note;
            s.target[v] = note;
            s.gate[v] = true;
            s.vel[v] = e.kind === 'gate' ? 1 : e.vel;
            s.offAt[v] = t + dur;
            s.age[v] = ++s.counter;
          }
          for (let v = 0; v < n; v++) {
            if (s.gate[v] && t >= s.offAt[v]!) s.gate[v] = false;
            s.pitch[v]! += (s.target[v]! - s.pitch[v]!) * coef;
            pitchOut[v]![i] = s.pitch[v]!;
            gateOut[v]![i] = s.gate[v] && !retrig[v] ? 1 : 0;
            retrig[v] = false;
            velOut[v]![i] = s.vel[v]!;
          }
        }
      },
      getState: () => ({ ...s, offAt: s.offAt.map((x) => (Number.isFinite(x) ? x : -1)) }),
      setState(state) {
        const st = state as VoicesState;
        s = { ...initial(), ...st, offAt: st.offAt.map((x) => (x < 0 ? Infinity : x)) };
      },
    };
  },
};

export default voices;
