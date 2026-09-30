/** Math: i due ingressi (grigi) e il risultato, negli ultimi 4 secondi. */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';
import { MATH_OPS } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = v.input.history('a', 4, 80);
    const b = v.input.history('b', 4, 80);
    const out = v.history('out', 4, 80);
    const all = [...a, ...b, ...out];
    const lo = Math.min(0, ...all);
    const hi = Math.max(1, ...all);
    sparkline(g, a, 2, 4, w - 4, h - 8, '#555', lo, hi);
    sparkline(g, b, 2, 4, w - 4, h - 8, '#3a4a5a', lo, hi);
    sparkline(g, out, 2, 4, w - 4, h - 8, C.value, lo, hi);
    label(g, MATH_OPS[Math.round(v.param('op'))] ?? '', 3, 1, C.white);
  },
});

export default view;
