/** Sample & Hold: l'ingresso (grigio), i gradini tenuti e i trigger che li hanno presi. */

import { C, clear, roll, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = v.input.history('in', 4, 100);
    const b = v.history('out', 4, 100);
    const lo = Math.min(0, ...a, ...b);
    const hi = Math.max(1, ...a, ...b);
    sparkline(g, a, 2, 4, w - 4, h - 12, '#555', lo, hi);
    sparkline(g, b, 2, 4, w - 4, h - 12, C.value, lo, hi);
    roll(g, v.events('trig', 4), v.now, 4, 2, h - 7, w - 4, 6, C.event);
  },
});

export default view;
