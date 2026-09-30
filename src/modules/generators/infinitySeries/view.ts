/** Serie infinita: il profilo dei prossimi 32 termini attorno allo zero, il primo acceso. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { norgard } from './index';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const steps = Math.max(1, Math.round(v.param('steps')));
    const k = Math.max(0, Math.floor(v.input.value('phase') * steps));
    const start = Math.round(v.param('start'));
    const stride = Math.round(v.param('stride'));
    const vals = Array.from({ length: 32 }, (_, i) => norgard(start + stride * (k + i)));
    const m = Math.max(3, ...vals.map(Math.abs));
    const mid = h / 2 + 4;
    const cw = w / 32;
    vals.forEach((x, i) => {
      g.fillStyle = i === 0 ? C.white : C.event;
      g.fillRect(i * cw + 1, mid - (x / m) * (h / 2 - 8) - 1.5, cw - 2, 3);
    });
    g.fillStyle = C.grid;
    g.fillRect(0, mid, w, 1);
    label(g, `a(${start + stride * k}) = ${vals[0]}`, 3, 1, C.white);
  },
});

export default view;
