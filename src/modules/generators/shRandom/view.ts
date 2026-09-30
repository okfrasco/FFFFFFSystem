/** S&H Random: i valori degli step attorno a adesso (anche quelli che verranno) e il punto attuale. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { shAt } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const steps = Math.max(1, Math.round(v.param('steps')));
    const smooth = v.param('smooth');
    const x = v.input.value('phase') * steps;
    const span = Math.max(4, steps * 2);
    const Y = (u: number) => h - 4 - u * (h - 8);
    g.lineWidth = 1.5;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass === 0 ? '#3a4a2a' : C.value;
      g.beginPath();
      for (let i = 0; i <= 160; i++) {
        const xi = x - span / 2 + (span * i) / 160;
        if (pass === 1 && xi > x) break;
        const py = Y(shAt(v.seed, xi, smooth));
        if (i === 0) g.moveTo((i / 160) * w, py);
        else g.lineTo((i / 160) * w, py);
      }
      g.stroke();
    }
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(w / 2, Y(shAt(v.seed, x, smooth)), 3, 0, Math.PI * 2);
    g.fill();
    label(g, `step ${Math.floor(frac(v.input.value('phase')) * steps) + 1}/${steps}`, 3, 1);
  },
});

export default view;
