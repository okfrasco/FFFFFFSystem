/** Lag: l'ingresso (grigio) e l'uscita che lo insegue, negli ultimi 4 secondi. */

import { C, clear, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = v.input.history('in', 4, 100);
    const b = v.history('out', 4, 100);
    const lo = Math.min(0, ...a, ...b);
    const hi = Math.max(1, ...a, ...b);
    sparkline(g, a, 2, 4, w - 4, h - 8, '#555', lo, hi);
    sparkline(g, b, 2, 4, w - 4, h - 8, C.value, lo, hi);
  },
});

export default view;
