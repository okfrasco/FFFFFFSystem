/** Campo armonico: il cerchio delle quinte con la scala e l'accordo, e l'accordo sulla tastiera. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { chordLabel, fifthsCircle, keys } from '../draw';
import { pc } from '../theory';

const view: ViewFactory = () => ({
  height: 70,
  draw(g, w, h, v) {
    clear(g, w, h);
    const scale = v.voices('scale');
    const chord = v.voices('chord').filter((p) => p > 0);
    const inScale = (p: number) => (scale[p] ?? 0) > 0.5;
    const pcs = new Set(chord.map(pc));
    const bass = chord.length ? pc(chord[0]!) : -1;
    const r = h / 2 - 6;
    fifthsCircle(g, r + 6, h / 2, r, inScale, (p) => (p === bass ? C.white : pcs.has(p) ? C.value : null), false);
    const kx = 2 * r + 16;
    const lo = chord.length ? chord[0]! - (chord[0]! % 12) : 48;
    keys(g, kx, 14, w - kx - 3, h - 18, lo, lo + 35, inScale, (n) => (chord.includes(n) ? (n === chord[0] ? C.white : C.value) : null));
    label(g, chordLabel(chord), kx, 1, C.white);
    const hit = v.events('change', 0.3).length > 0;
    if (hit) label(g, '●', w - 3, 1, C.event, 'right');
  },
});

export default view;
