/**
 * Campo armonico — lo stato armonico da cui leggono gli altri nodi: una
 * tonalità (tonica e scala; i primi sette modi sono in ordine di brightness,
 * dal lidio al locrio) e l'accordo sul grado scelto, per terze della scala.
 * Uscite del campo: `scale` (12 voci), `chord` (basso per primo), `change`.
 *
 * Con `scale` e `root` collegati (da Cerchio delle quinte, Sus Slash) la
 * tonalità viene da lì, e qui si sceglie solo l'accordo.
 */

import type { ModuleDefinition } from '../../../core/types';
import { FIELD_SCALES, NOTE_NAMES, diatonicChord, invert, pc, readScale, sameNotes, scalePcs, writeField } from '../theory';

interface FieldState {
  chord: number[];
  scale: number[];
}

export const harmonicField: ModuleDefinition = {
  manifest: {
    id: 'harmonicField',
    name: 'Campo armonico',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'root', type: 'control', signal: 'value' },
    ],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'root', type: 'control', signal: 'value' },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'root', label: 'Tonica', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'scale', label: 'Scala', min: 0, max: FIELD_SCALES.length - 1, default: 1, kind: 'discrete', options: FIELD_SCALES.map((s) => s.name) },
      { id: 'degree', label: 'Grado', min: 1, max: 7, default: 1, kind: 'discrete' },
      { id: 'size', label: 'Note', min: 1, max: 7, default: 4, kind: 'discrete' },
      { id: 'inversion', label: 'Rivolto', min: 0, max: 6, default: 0, kind: 'discrete' },
      { id: 'octave', label: 'Ottava', min: 24, max: 84, default: 48, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let s: FieldState = { chord: [], scale: [] };
    return {
      process(ctx, inputs, outputs) {
        const inScale = readScale(inputs.control('scale'));
        const rootIn = inputs.control('root');
        const root = rootIn && inScale ? pc(rootIn.values[0]!) : ctx.discrete('root', 0);
        const scale = inScale ?? scalePcs(root, FIELD_SCALES[ctx.discrete('scale', 0)]!.steps);
        // la scala dalla tonica in su, per contare i gradi
        const ordered = scale.map((p) => (p < root ? p + 12 : p)).sort((a, b) => a - b);
        const rel = diatonicChord(ordered, ctx.discrete('degree', 0) - 1, ctx.discrete('size', 0));
        const base = ctx.discrete('octave', 0);
        const chord = invert(rel.map((p) => base + p), ctx.discrete('inversion', 0));
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), chord, scale);
        outputs.control('root').values[0] = root;
        if (!sameNotes(chord, s.chord) || !sameNotes(scale, s.scale)) {
          outputs.control('change').events.push({ kind: 'trig', t: ctx.t0, voice: 0, vel: 1, value: pc(chord[0] ?? root) });
          s = { chord, scale };
        }
      },
      getState: () => ({ chord: [...s.chord], scale: [...s.scale] }),
      setState(state) {
        const st = state as FieldState;
        s = { chord: [...st.chord], scale: [...st.scale] };
      },
    };
  },
};

export default harmonicField;
