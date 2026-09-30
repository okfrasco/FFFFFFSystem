/** Blend: A e B in grigio, l'uscita in verde, e il cursore del crossfade. */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = v.input.history('a', 4, 80);
    const b = v.input.history('b', 4, 80);
    const o = v.history('out', 4, 80);
    const lo = Math.min(0, ...a, ...b, ...o);
    const hi = Math.max(1, ...a, ...b, ...o);
    sparkline(g, a, 2, 10, w - 4, h - 12, '#555', lo, hi);
    sparkline(g, b, 2, 10, w - 4, h - 12, '#3a4a5a', lo, hi);
    sparkline(g, o, 2, 10, w - 4, h - 12, C.value, lo, hi);
    const m = v.param('mix');
    g.fillStyle = C.grid;
    g.fillRect(14, 4, w - 28, 2);
    g.fillStyle = C.white;
    g.fillRect(14 + m * (w - 28) - 2, 1, 4, 8);
    label(g, 'A', 2, 1);
    label(g, 'B', w - 2, 1, C.text, 'right');
  },
});

export default view;
