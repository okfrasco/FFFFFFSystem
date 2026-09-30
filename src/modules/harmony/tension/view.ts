/** Tensione: l'accordo in ingresso (azzurro) e le note aggiunte o alterate (arancio). */

import { C, clear, label, meter, type ViewFactory } from '../../../ui/editor/viewKit';
import { chordLabel, keys } from '../draw';

const view: ViewFactory = () => ({
  height: 50,
  draw(g, w, h, v) {
    clear(g, w, h);
    const input = v.input.voices('chord').filter((p) => p > 0);
    const out = v.voices('chord').filter((p) => p > 0);
    const scale = v.voices('scale');
    const lo = out.length ? out[0]! - (out[0]! % 12) : 48;
    keys(g, 10, 13, w - 12, h - 15, lo, lo + 35, (p) => (scale[p] ?? 0) > 0.5, (n) => (out.includes(n) ? (input.includes(n) ? C.value : C.event) : null));
    meter(g, v.param('amount'), 2, 13, 5, h - 15, C.event);
    label(g, chordLabel(out), 3, 0, C.white);
  },
});

export default view;
