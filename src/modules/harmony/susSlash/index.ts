/**
 * Sus Slash — una struttura sus (o uno stack quartale o quintale) sopra una
 * nota di basso. Per ogni variante sono utilizzabili solo certi bassi (vedi
 * SUS_VARIANTS in ../theory.ts):
 *   sus        tutti (i più tosti: ♭2 e ♯4, per Csus C♯ e F♯)
 *   sus♭5      la scala lidia della nota bassa del sus
 *   sus♯5      la scala minore della stessa nota più la terza maggiore
 *   sus♭2      un po' tutti
 *   sus♭2♭5    lidio più la quarta
 *   sus♭2♯5    la scala maggiore
 *   quartale, quintale   tutti, come il sus
 *
 * `bass` sceglie tra i bassi utilizzabili ordinati per brightness (dal più
 * scuro al più luminoso sul cerchio delle quinte); `tension` sotto 0.5 lascia
 * fuori i più tosti. Uscite del campo: accordo (basso + struttura), scala per
 * le melodie, basso, change.
 */

import type { ModuleDefinition } from '../../../core/types';
import { NOTE_NAMES, SUS_VARIANTS, diatonicFor, pc, sameNotes, susBasses, susStructure, writeField } from '../theory';

interface SusState {
  chord: number[];
}

/** Accordo (MIDI) e scala di una configurazione di Sus Slash. */
export function susChord(root: number, variant: number, notes: number, bassSel: number, tension: number, bassOctave: number) {
  const v = SUS_VARIANTS[variant] ?? SUS_VARIANTS[0]!;
  const basses = susBasses(v, tension);
  const b = basses[Math.min(basses.length - 1, Math.max(0, Math.floor(bassSel * basses.length)))] ?? 0;
  const bass = bassOctave + pc(root + b);
  // il sus sopra il basso, con almeno una settima di distanza
  const top = bass + 10 + pc(root - bass - 10);
  const chord = [bass, ...susStructure(v, notes).map((i) => top + i)];
  const pcs = chord.map(pc);
  const scale = v.scale ? v.scale.map((s) => pc(root + s)) : (diatonicFor(pcs, root) ?? [...new Set(pcs)]);
  return { chord, scale: [...new Set([...scale, ...pcs])].sort((a, b) => a - b), basses: basses.map((x) => pc(root + x)), bass };
}

export const susSlash: ModuleDefinition = {
  manifest: {
    id: 'susSlash',
    name: 'Sus Slash',
    category: 'harmony',
    rate: 'control',
    inputs: [],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'bass', type: 'control', signal: 'value' },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'root', label: 'Nota del sus', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'variant', label: 'Variante', min: 0, max: SUS_VARIANTS.length - 1, default: 0, kind: 'discrete', options: SUS_VARIANTS.map((v) => v.name) },
      { id: 'bass', label: 'Basso (scuro → luminoso)', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'tension', label: 'Tensione', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'notes', label: 'Note dello stack', min: 2, max: 6, default: 3, kind: 'discrete' },
      { id: 'octave', label: 'Ottava del basso', min: 24, max: 60, default: 36, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let s: SusState = { chord: [] };
    return {
      process(ctx, inputs, outputs) {
        void inputs;
        const r = susChord(ctx.discrete('root', 0), ctx.discrete('variant', 0), ctx.discrete('notes', 0), ctx.param('bass'), ctx.param('tension'), ctx.discrete('octave', 0));
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), r.chord, r.scale);
        outputs.control('bass').values[0] = r.bass;
        if (!sameNotes(r.chord, s.chord)) {
          outputs.control('change').events.push({ kind: 'trig', t: ctx.t0, voice: 0, vel: 1, value: pc(r.bass) });
          s = { chord: r.chord };
        }
      },
      getState: () => ({ chord: [...s.chord] }),
      setState(state) {
        s = { chord: [...(state as SusState).chord] };
      },
    };
  },
};

export default susSlash;
