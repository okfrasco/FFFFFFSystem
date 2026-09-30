/** Shift Register: le celle in fila come barre, che scorrono a ogni colpo. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    const cells = v.state<number[]>() ?? [];
    const N = Math.max(1, Math.round(v.param('length')));
    const lo = Math.min(0, ...cells);
    const hi = Math.max(1, ...cells);
    const cw = (w - 8) / N;
    for (let i = 0; i < N; i++) {
      const x = cells[i];
      g.fillStyle = '#1d1d24';
      g.fillRect(4 + i * cw, 4, cw - 2, h - 8);
      if (x === undefined) continue;
      const u = (x - lo) / (hi - lo);
      g.fillStyle = i === 0 ? C.white : C.value;
      g.fillRect(4 + i * cw, h - 4 - u * (h - 8), cw - 2, u * (h - 8));
    }
    label(g, '→', w - 10, 1);
  },
});

export default view;
