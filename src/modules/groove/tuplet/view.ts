/** Tupla: gli N colpi sulla durata, contro i beat dritti (tacche grigie). */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 36,
  draw(g, w, h, v) {
    clear(g, w, h);
    const n = Math.round(v.param('n'));
    const span = v.param('span');
    const pos = frac(v.input.value('phase') / span);
    const x = (f: number) => 4 + f * (w - 8);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#333';
      g.fillRect(x(i / 4) - 0.5, h - 10, 1, 8);
    }
    for (let i = 0; i < n; i++) {
      g.fillStyle = i === Math.floor(pos * n) ? C.white : i === 0 ? C.event : '#8a5a2a';
      g.fillRect(x(i / n) - 1.5, 12, 3, h - 24);
    }
    g.fillStyle = C.phase;
    g.fillRect(x(pos) - 0.5, 10, 1, h - 12);
    label(g, `${n} : 4`, 3, 0, C.white);
  },
});

export default view;
