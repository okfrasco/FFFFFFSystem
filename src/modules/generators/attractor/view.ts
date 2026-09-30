/** Attrattore: la traccia degli ultimi 8 secondi proiettata su x–z, con il punto attuale. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { ATTRACTORS } from './index';

const view: ViewFactory = () => ({
  height: 72,
  draw(g, w, h, v) {
    clear(g, w, h);
    const xs = v.history('x', 8, 300);
    const zs = v.history('z', 8, 300);
    const s = h - 6;
    const ox = (w - s) / 2;
    g.lineWidth = 1;
    for (let i = 1; i < xs.length; i++) {
      g.strokeStyle = `rgba(198,255,77,${0.1 + 0.9 * (i / xs.length)})`;
      g.beginPath();
      g.moveTo(ox + xs[i - 1]! * s, 3 + s - zs[i - 1]! * s);
      g.lineTo(ox + xs[i]! * s, 3 + s - zs[i]! * s);
      g.stroke();
    }
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(ox + v.value('x') * s, 3 + s - v.value('z') * s, 3, 0, Math.PI * 2);
    g.fill();
    label(g, ATTRACTORS[Math.round(v.param('system'))] ?? '', 3, 1, C.white);
  },
});

export default view;
