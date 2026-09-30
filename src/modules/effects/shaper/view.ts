/** Shaper: la curva di trasferimento (ingresso → uscita) e, sotto, il segnale che esce. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { SHAPER_MODES, shape } from './index';

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const mode = Math.round(v.param('mode'));
    const drive = v.param('drive');
    const order = Math.round(v.param('order'));
    const bias = v.param('symmetry') * 0.5;
    const s = h - 6;
    const x0 = 3;
    const y0 = 3;
    g.strokeStyle = C.grid;
    g.strokeRect(x0, y0, s, s);
    g.beginPath();
    g.moveTo(x0, y0 + s / 2);
    g.lineTo(x0 + s, y0 + s / 2);
    g.moveTo(x0 + s / 2, y0);
    g.lineTo(x0 + s / 2, y0 + s);
    g.stroke();
    g.strokeStyle = C.audio;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = -1 + (2 * i) / 80;
      const y = Math.max(-1.2, Math.min(1.2, shape(mode, x + bias, drive, order)));
      const px = x0 + ((x + 1) / 2) * s;
      const py = y0 + s / 2 - (y / 2) * s;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    scope(g, v.scope('out'), s + 10, 12, w - s - 12, h - 16, C.audio);
    label(g, `${SHAPER_MODES[mode]}${mode === 2 ? ` T${order}` : ''} · ×${drive.toFixed(1)}`, s + 10, 1);
  },
});

export default view;
