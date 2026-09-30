/** Scale / Offset: la retta ingresso → uscita (0–1 in orizzontale) e il punto adesso. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { scaleOffset } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const sc = v.param('scale');
    const off = v.param('offset');
    const inv = Math.round(v.param('invert'));
    const y0 = scaleOffset(0, sc, off, inv);
    const y1 = scaleOffset(1, sc, off, inv);
    const lo = Math.min(0, y0, y1);
    const hi = Math.max(1, y0, y1);
    const Y = (y: number) => h - 4 - ((y - lo) / (hi - lo)) * (h - 8);
    g.strokeStyle = C.grid;
    g.beginPath();
    g.moveTo(0, Y(0));
    g.lineTo(w, Y(0));
    g.stroke();
    g.strokeStyle = C.value;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(4, Y(y0));
    g.lineTo(w - 4, Y(y1));
    g.stroke();
    const x = Math.max(0, Math.min(1, v.input.value('in')));
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(4 + x * (w - 8), Y(scaleOffset(x, sc, off, inv)), 3, 0, Math.PI * 2);
    g.fill();
    label(g, `×${sc.toFixed(2)} ${off >= 0 ? '+' : '−'}${Math.abs(off).toFixed(2)}`, 3, 1);
  },
});

export default view;
