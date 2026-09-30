/** Accordi: il nome e l'accordo sulla tastiera (basso in bianco). */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { chordLabel, keys } from '../draw';
import { CHORD_TYPES, NOTE_NAMES, pc } from '../theory';

const view: ViewFactory = () => ({
  height: 50,
  draw(g, w, h, v) {
    clear(g, w, h);
    const chord = v.voices('chord').filter((p) => p > 0);
    const scale = v.voices('scale');
    const lo = chord.length ? chord[0]! - pc(chord[0]!) : 48;
    keys(g, 2, 13, w - 4, h - 15, lo, lo + 47, (p) => (scale[p] ?? 0) > 0.5, (n) => (n === chord[0] ? C.white : chord.includes(n) ? C.value : null));
    const type = CHORD_TYPES[Math.round(v.param('type'))]?.name ?? '';
    label(g, `${chord.length ? NOTE_NAMES[pc(chord[0]!)] : ''} ${type}`, 3, 0, C.white);
    label(g, chordLabel(chord), w - 3, 0, C.dim, 'right');
  },
});

export default view;
