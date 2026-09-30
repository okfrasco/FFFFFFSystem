/**
 * Quantize a scala — trasforma colpi con valore in note su una scala.
 *
 * Modo "0–1 → range": il valore 0–1 copre `range` semitoni sopra `base`, poi
 * si prende la nota di scala più vicina. Modo "grado": il valore è un grado di
 * scala (0 = tonica sopra `base`, 7 in maggiore = ottava, negativi sotto).
 * Il valore viene dal trigger stesso se lo porta (Markov, Steps, L-system),
 * altrimenti dall'ingresso `pitch`. Le note in ingresso vengono solo portate
 * sulla scala.
 */

import type { ModuleDefinition, NoteEvent } from '../../../core/types';

export const SCALES: readonly { name: string; steps: readonly number[] }[] = [
  { name: 'maggiore', steps: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'minore', steps: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'dorico', steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'frigio', steps: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'lidio', steps: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'misolidio', steps: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'locrio', steps: [0, 1, 3, 5, 6, 8, 10] },
  { name: 'minore armonica', steps: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'minore melodica', steps: [0, 2, 3, 5, 7, 9, 11] },
  { name: 'pentatonica maggiore', steps: [0, 2, 4, 7, 9] },
  { name: 'pentatonica minore', steps: [0, 3, 5, 7, 10] },
  { name: 'esatonale', steps: [0, 2, 4, 6, 8, 10] },
  { name: 'cromatica', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Nota di scala più vicina a `pitch` (a parità, quella sotto). */
export function nearestInScale(pitch: number, root: number, steps: readonly number[]): number {
  let best = Math.round(pitch);
  let bestDist = Infinity;
  const oct = Math.floor((pitch - root) / 12);
  for (let o = oct - 1; o <= oct + 1; o++) {
    for (const st of steps) {
      const p = root + 12 * o + st;
      const d = Math.abs(p - pitch);
      if (d < bestDist - 1e-9) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}

/** Grado di scala (anche negativo o frazionario, arrotondato) → nota MIDI. */
export function degreeToPitch(degree: number, base: number, root: number, steps: readonly number[]): number {
  const d = Math.round(degree);
  const n = steps.length;
  const oct = Math.floor(d / n);
  const idx = d - oct * n;
  return base + root + 12 * oct + (steps[idx] ?? 0);
}

interface QuantizeState {
  counter: number;
  last: number[];
}

export const quantize: ModuleDefinition = {
  manifest: {
    id: 'quantize',
    name: 'Quantize a scala',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'pitch', type: 'control', signal: 'value', poly: true },
    ],
    outputs: [{ id: 'note', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'root', label: 'Tonica', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'scale', label: 'Scala', min: 0, max: SCALES.length - 1, default: 0, kind: 'discrete', options: SCALES.map((x) => x.name) },
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 1, kind: 'discrete', options: ['0–1 → range', 'grado'] },
      { id: 'base', label: 'Base', min: 24, max: 96, default: 48, kind: 'discrete' },
      { id: 'range', label: 'Range', min: 0, max: 48, default: 24, kind: 'continuous', unit: 'st' },
      { id: 'length', label: 'Durata', min: 0.02, max: 4, default: 0.2, kind: 'continuous', curve: 'exp', unit: 's' },
    ],
    seeded: false,
  },

  create() {
    let s: QuantizeState = { counter: 0, last: [] };
    return {
      process(ctx, inputs, outputs) {
        const trig = inputs.control('trig');
        if (!trig) return;
        const pitchIn = inputs.control('pitch');
        const voices = Math.max(trig.values.length, pitchIn?.values.length ?? 1);
        const out = outputs.control('note', voices);
        for (const e of trig.events) {
          if (e.kind === 'gate') continue;
          const v = e.voice;
          const key = s.counter++;
          const root = ctx.discrete('root', key, v);
          const steps = SCALES[ctx.discrete('scale', key, v)]?.steps ?? SCALES[0]!.steps;
          const base = ctx.discrete('base', key, v);
          let pitch: number;
          if (e.kind === 'note') pitch = nearestInScale(e.pitch, root, steps);
          else {
            const x = e.value ?? (pitchIn ? (pitchIn.values[v % pitchIn.values.length] ?? 0) : 0);
            pitch =
              ctx.discrete('mode', key, v) === 1
                ? degreeToPitch(x, base, root, steps)
                : nearestInScale(base + x * ctx.param('range', v), root, steps);
          }
          pitch = Math.max(0, Math.min(127, pitch));
          s.last[v] = pitch;
          const note: NoteEvent = {
            kind: 'note',
            t: e.t,
            voice: v,
            pitch,
            vel: e.vel,
            dur: e.kind === 'note' ? e.dur : ctx.param('length', v),
          };
          out.events.push(note);
        }
        for (let v = 0; v < voices; v++) out.values[v] = (s.last[v] ?? 0) / 127;
      },
      getState: () => ({ counter: s.counter, last: [...s.last] }),
      setState(state) {
        const st = state as QuantizeState;
        s = { counter: st.counter, last: [...st.last] };
      },
    };
  },
};

export default quantize;
