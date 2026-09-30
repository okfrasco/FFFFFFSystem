/** Grid Blend: le due griglie (A sopra, B sotto) e dove finiscono i punti di A con la miscela. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { gridShift } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = Math.round(v.param('a'));
    const b = Math.round(v.param('b'));
    const blend = v.param('blend');
    const X = (f: number) => 4 + f * (w - 8);
    for (let i = 0; i < a; i++) {
      g.fillStyle = '#555';
      g.fillRect(X(i / a) - 0.5, 12, 1, 6);
    }
    for (let i = 0; i < b; i++) {
      g.fillStyle = '#3a4a5a';
      g.fillRect(X(i / b) - 0.5, h - 8, 1, 6);
    }
    for (let i = 0; i < a; i++) {
      const p = i / a;
      g.fillStyle = C.event;
      g.fillRect(X(p + gridShift(p, a, b, blend)) - 1, 20, 2, h - 30);
    }
    label(g, `${a} → ${b} · ${Math.round(blend * 100)}%`, 3, 0, C.white);
  },
});

export default view;
