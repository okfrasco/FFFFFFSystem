/**
 * Drum voice — percussioni sintetiche su trigger, al campione:
 * kick (seno con caduta di pitch + click), snare (due toni + rumore),
 * hat (rumore passa-alto), clap (tre raffiche di rumore + coda), blip (ping).
 * `tone` cambia il carattere di ciascuna (click, rumore, brillantezza).
 */

import { framedEvents } from '../../core/dsp';
import type { ModuleDefinition } from '../../core/types';

const TAU = 2 * Math.PI;
export const DRUM_TYPES = ['kick', 'snare', 'hat', 'clap', 'blip'] as const;

interface DrumState {
  active: boolean;
  n: number; // campioni dal colpo
  type: number;
  vel: number;
  ph1: number;
  ph2: number;
  hp1: number;
  hp2: number;
  xPrev: number;
  bp: number;
  counter: number;
}

const initial = (): DrumState => ({ active: false, n: 0, type: 0, vel: 0, ph1: 0, ph2: 0, hp1: 0, hp2: 0, xPrev: 0, bp: 0, counter: 0 });

export const drum: ModuleDefinition = {
  manifest: {
    id: 'drum',
    name: 'Drum voice',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'trig', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'audio' }],
    params: [
      { id: 'type', label: 'Tipo', min: 0, max: DRUM_TYPES.length - 1, default: 0, kind: 'discrete', options: [...DRUM_TYPES] },
      { id: 'tune', label: 'Intonazione', min: -24, max: 24, default: 0, kind: 'continuous', unit: 'st' },
      { id: 'decay', label: 'Decadimento', min: 0.02, max: 3, default: 0.3, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'tone', label: 'Tono', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.8, kind: 'continuous' },
    ],
    seeded: true,
  },

  create() {
    let s = initial();
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.audio('out').channels[0]!;
        const events = framedEvents(ctx, inputs.control('trig')?.events ?? []);
        const sr = ctx.sampleRate;
        const tune = Math.pow(2, ctx.param('tune') / 12);
        const decay = ctx.param('decay');
        const tone = ctx.param('tone');
        const level = ctx.param('level');
        const rng = ctx.rng;
        let ei = 0;
        for (let i = 0; i < ctx.frames; i++) {
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind === 'gate' && !e.on) continue;
            s.active = true;
            s.n = 0;
            s.type = ctx.discrete('type', s.counter++);
            s.vel = e.kind === 'gate' ? 1 : e.vel;
            s.ph1 = 0;
            s.ph2 = 0;
          }
          if (!s.active) {
            out[i] = 0;
            continue;
          }
          const t = s.n / sr;
          const noise = rng.float() * 2 - 1;
          let y = 0;
          let env = Math.exp(-t / decay);
          switch (s.type) {
            case 0: {
              // kick
              const f = 48 * tune * (1 + (2 + 4 * tone) * Math.exp(-t / 0.03));
              s.ph1 += f / sr;
              y = Math.sin(TAU * s.ph1) * env + noise * Math.exp(-t / 0.002) * 0.4 * tone;
              break;
            }
            case 1: {
              // snare: corpo a due toni + rumore passa-alto
              s.ph1 += (185 * tune) / sr;
              s.ph2 += (330 * tune) / sr;
              const body = (Math.sin(TAU * s.ph1) + 0.5 * Math.sin(TAU * s.ph2)) * Math.exp(-t / 0.05);
              s.hp1 = 0.9 * (s.hp1 + noise - s.xPrev);
              s.xPrev = noise;
              y = body * (1 - 0.6 * tone) * 0.7 + s.hp1 * env * (0.4 + 0.6 * tone);
              break;
            }
            case 2: {
              // hat: rumore passa-alto a due poli, più brillante con tone
              const a = 0.6 + 0.35 * tone;
              s.hp1 = a * (s.hp1 + noise - s.xPrev);
              s.xPrev = noise;
              s.hp2 = a * (s.hp2 + s.hp1 - s.bp);
              s.bp = s.hp1;
              y = s.hp2 * env * 0.8;
              break;
            }
            case 3: {
              // clap: tre raffiche a 10 ms più una coda, rumore filtrato
              const burst = t < 0.03 ? Math.exp(-(t % 0.01) / 0.003) : 0;
              env = Math.max(burst, Math.exp(-(t - 0.02) / decay) * (t >= 0.02 ? 1 : 0));
              s.bp += (0.25 + 0.5 * tone) * (noise - s.bp);
              s.hp1 = 0.8 * (s.hp1 + s.bp - s.xPrev);
              s.xPrev = s.bp;
              y = s.hp1 * env * 1.6;
              break;
            }
            default: {
              // blip
              s.ph1 += (880 * tune) / sr;
              y = Math.sin(TAU * s.ph1 + tone * 2 * Math.sin(TAU * s.ph1 * 2)) * Math.exp(-t / (decay * 0.3));
            }
          }
          out[i] = y * s.vel * level;
          s.n++;
          if (t > 0.03 && env < 1e-4) s.active = false;
        }
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...initial(), ...(state as DrumState) };
      },
    };
  },
};
