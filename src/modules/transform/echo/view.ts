/** Echo: lo schema delle ripetizioni (distanza e velocity che cala) e i colpi che escono. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const reps = Math.round(v.param('repeats'));
    const decay = v.param('decay');
    const barH = 20;
    let vel = 1;
    for (let k = 0; k <= reps; k++) {
      const x = 4 + (k / Math.max(1, reps)) * (w * 0.5 - 8);
      g.fillStyle = k === 0 ? C.white : C.event;
      g.globalAlpha = 0.3 + 0.7 * vel;
      g.fillRect(x - 1, 4 + barH * (1 - vel), 2, barH * vel);
      vel *= decay;
    }
    g.globalAlpha = 1;
    roll(g, v.events('out', 3), v.now, 3, w * 0.5, 4, w * 0.5 - 4, h - 8, C.event);
    const tr = Math.round(v.param('transpose'));
    label(g, `×${reps}${tr ? ` ${tr > 0 ? '+' : ''}${tr} st` : ''}`, 4, h - 12);
  },
});

export default view;
