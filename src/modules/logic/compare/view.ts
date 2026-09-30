/** Comparatore: A (verde) e B (grigio) negli ultimi 4 secondi, con le zone in cui il gate è alto. */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';
import { COMPARE_OPS } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const gate = v.history('gate', 4, 100);
    g.fillStyle = '#2a2614';
    gate.forEach((x, i) => {
      if (x >= 0.5) g.fillRect((i / gate.length) * w, 0, w / gate.length + 0.5, h);
    });
    const a = v.input.history('a', 4, 100);
    const bIn = v.input.history('b', 4, 100);
    const b = bIn.length ? bIn : a.map(() => v.param('b'));
    const lo = Math.min(0, ...a, ...b);
    const hi = Math.max(1, ...a, ...b);
    sparkline(g, b, 2, 4, w - 4, h - 8, '#666', lo, hi);
    sparkline(g, a, 2, 4, w - 4, h - 8, C.value, lo, hi);
    label(g, `A ${COMPARE_OPS[Math.round(v.param('op'))]} B`, 3, 1, C.white);
  },
});

export default view;
