/** Ø Bend: la curva di piegatura e il punto che la percorre adesso. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { bendCurve } from './index';

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const amount = v.param('amount');
    const mode = Math.round(v.param('mode'));
    const s = h - 8;
    const x0 = 4;
    const y0 = 4;
    g.strokeStyle = C.grid;
    g.strokeRect(x0, y0, s, s);
    g.beginPath();
    g.moveTo(x0, y0 + s);
    g.lineTo(x0 + s, y0);
    g.stroke();
    g.strokeStyle = C.phase;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const px = x0 + u * s;
      const py = y0 + s - bendCurve(u, amount, mode) * s;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    const u = frac(v.input.value('in'));
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(x0 + u * s, y0 + s - frac(v.value('out')) * s, 3, 0, Math.PI * 2);
    g.fill();
    label(g, mode === 1 ? 'pinch' : 'bend', s + 12, 8, C.white);
    label(g, amount.toFixed(2), s + 12, 22);
  },
});

export default view;
