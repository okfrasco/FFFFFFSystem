/**
 * Accordi — un accordo da fondamentale, tipo ed estensioni (dalla triade al
 * 13 e al 7alt), con rivolto, voicing (stretto, drop 2, aperto) e il basso
 * della fondamentale un'ottava sotto. La fondamentale può arrivare da un cavo
 * (`root`: classe 0–11 o nota MIDI), per esempio da Markov o Steps.
 * Uscite del campo: accordo, scala (la diatonica più vicina che lo contiene,
 * o le sue note), change.
 */

import type { ModuleDefinition } from '../../../core/types';
import { CHORD_TYPES, NOTE_NAMES, diatonicFor, drop2, invert, pc, sameNotes, writeField } from '../theory';

export const VOICINGS = ['stretto', 'drop 2', 'aperto'] as const;

export function buildChord(root: number, type: number, inversion: number, voicing: number, octave: number, bass: boolean): number[] {
  const iv = CHORD_TYPES[type]?.iv ?? CHORD_TYPES[0]!.iv;
  let notes = invert(iv.map((i) => octave + pc(root) + i), inversion);
  if (voicing === 1) notes = drop2(notes);
  else if (voicing === 2) notes = notes.map((p, i) => (i % 2 === 1 ? p + 12 : p)).sort((a, b) => a - b);
  if (bass) notes = [octave + pc(root) - 12, ...notes];
  return notes;
}

export const chords: ModuleDefinition = {
  manifest: {
    id: 'chords',
    name: 'Accordi',
    category: 'harmony',
    rate: 'control',
    inputs: [{ id: 'root', type: 'control', signal: 'value' }],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'root', label: 'Fondamentale', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'type', label: 'Tipo', min: 0, max: CHORD_TYPES.length - 1, default: 9, kind: 'discrete', options: CHORD_TYPES.map((c) => c.name) },
      { id: 'inversion', label: 'Rivolto', min: 0, max: 5, default: 0, kind: 'discrete' },
      { id: 'voicing', label: 'Voicing', min: 0, max: VOICINGS.length - 1, default: 0, kind: 'discrete', options: [...VOICINGS] },
      { id: 'bass', label: 'Basso', min: 0, max: 1, default: 1, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'octave', label: 'Ottava', min: 36, max: 72, default: 60, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let last: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const rootIn = inputs.control('root');
        const root = rootIn ? pc(rootIn.values[0]!) : ctx.discrete('root', 0);
        const chord = buildChord(root, ctx.discrete('type', 0), ctx.discrete('inversion', 0), ctx.discrete('voicing', 0), ctx.discrete('octave', 0), ctx.discrete('bass', 0) === 1);
        const pcs = chord.map(pc);
        const scale = diatonicFor(pcs, root) ?? [...new Set(pcs)].sort((a, b) => a - b);
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), chord, scale);
        if (!sameNotes(chord, last)) {
          outputs.control('change').events.push({ kind: 'trig', t: ctx.t0, voice: 0, vel: 1, value: root });
          last = chord;
        }
      },
      getState: () => ({ last: [...last] }),
      setState(state) {
        last = [...((state as { last?: number[] }).last ?? [])];
      },
    };
  },
};

export default chords;
