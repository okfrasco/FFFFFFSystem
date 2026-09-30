/** Quantize a scalini: l'ingresso (grigio) e i gradini in cui cade. */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lo = Math.min(v.param('lo'), v.param('hi'));
    const hi = Math.max(v.param('lo'), v.param('hi'));
    const n = Math.round(v.param('levels'));
    g.fillStyle = '#1b1b22';
    for (let i = 0; i < n; i++) g.fillRect(0, h - 4 - (i / (n - 1)) * (h - 8), w, 1);
    sparkline(g, v.input.history('in', 4, 100), 2, 4, w - 4, h - 8, '#555', lo, hi);
    sparkline(g, v.history('out', 4, 100), 2, 4, w - 4, h - 8, C.value, lo, hi);
    label(g, `${n} gradini`, 3, 1);
  },
});

export default view;
