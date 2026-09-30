/**
 * Acid — pattern alla 303: 16 step, ognuno con nota, accento, slide o pausa,
 * generati dal seed e ripetuti come una memoria di sequencer. `mutate` a ogni
 * battuta cambia uno step con quella probabilità, così il pattern evolve
 * lentamente. Le note escono come eventi nota: gli step con slide durano un
 * po' più dello step e si sovrappongono al successivo (con le Voci in legato
 * e un po' di glide, scivolano senza ripartire).
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { Rng } from '../../../core/rng';
import type { ModuleDefinition } from '../../../core/types';

export const ACID_SCALES: Record<string, number[]> = {
  minore: [0, 2, 3, 5, 7, 8, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  'pentatonica minore': [0, 3, 5, 7, 10],
  cromatica: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const SCALE_NAMES = Object.keys(ACID_SCALES);

export interface AcidStep {
  note: number | null; // semitoni sopra la base, null = pausa
  accent: boolean;
  slide: boolean;
}

export function makeAcidStep(rng: Rng, scale: number[], density: number, accent: number, slide: number, octave: number): AcidStep {
  if (!rng.chance(density)) return { note: null, accent: false, slide: false };
  let note = rng.pick(scale);
  if (rng.chance(octave)) note += rng.chance(0.7) ? 12 : -12;
  return { note, accent: rng.chance(accent), slide: rng.chance(slide) };
}

interface AcidState {
  steps: AcidStep[];
  bar: number;
}

export const acid: ModuleDefinition = {
  manifest: {
    id: 'acid',
    name: 'Acid',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'note', type: 'control', signal: 'event' },
      { id: 'accent', type: 'control', signal: 'event' },
      { id: 'slide', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'base', label: 'Base', min: 24, max: 60, default: 36, kind: 'discrete' },
      { id: 'scale', label: 'Scala', min: 0, max: SCALE_NAMES.length - 1, default: 0, kind: 'discrete', options: SCALE_NAMES },
      { id: 'density', label: 'Densità', min: 0.2, max: 1, default: 0.75, kind: 'continuous' },
      { id: 'accent', label: 'Accenti', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'slide', label: 'Slide', min: 0, max: 1, default: 0.25, kind: 'continuous' },
      { id: 'octave', label: 'Ottave', min: 0, max: 1, default: 0.2, kind: 'continuous' },
      { id: 'mutate', label: 'Muta', min: 0, max: 1, default: 0.15, kind: 'continuous' },
      { id: 'gate', label: 'Gate', min: 0.1, max: 1, default: 0.5, kind: 'continuous', unit: 'step' },
    ],
    seeded: true,
  },
  create() {
    let s: AcidState | null = null;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const scale = ACID_SCALES[SCALE_NAMES[ctx.discrete('scale', 0)] ?? 'minore']!;
        const gen = () => makeAcidStep(ctx.rng, scale, ctx.param('density'), ctx.param('accent'), ctx.param('slide'), ctx.param('octave'));
        s ??= { steps: Array.from({ length: 16 }, gen), bar: Math.floor(ph.start[0]!) };
        const noteOut = outputs.control('note');
        const accentOut = outputs.control('accent');
        const a = ph.start[0]!;
        const b = ph.end[0]!;
        const stepDur = b !== a ? Math.abs((ctx.t1 - ctx.t0) / ((b - a) * 16)) : 0;
        for (const hit of stepCrossings(a, b, 16, ctx.t0, ctx.t1)) {
          const bar = Math.floor(hit.step / 16);
          if (bar !== s.bar) {
            // una battuta nuova: la memoria muta un po'
            s.bar = bar;
            if (ctx.rng.chance(ctx.param('mutate'))) s.steps[ctx.rng.int(0, 16)] = gen();
          }
          const st = s.steps[mod(hit.step, 16)]!;
          if (st.note === null) continue;
          const dur = st.slide ? stepDur * 1.1 : stepDur * ctx.param('gate');
          const vel = st.accent ? 1 : 0.6;
          noteOut.events.push({ kind: 'note', t: hit.t, voice: 0, pitch: ctx.discrete('base', hit.step) + st.note, vel, dur });
          if (st.accent) accentOut.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1 });
          outputs.control('slide').values[0] = st.slide ? 1 : 0;
        }
      },
      getState: () => (s ? { steps: s.steps.map((x) => ({ ...x })), bar: s.bar } : null),
      setState(state) {
        const st = state as AcidState | null;
        s = st ? { steps: st.steps.map((x) => ({ ...x })), bar: st.bar } : null;
      },
    };
  },
};

export default acid;
