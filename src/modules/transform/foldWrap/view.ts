/** Fold / Wrap: la curva ingresso → uscita su −2…2 e la fascia dei limiti. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { foldWrap } from './index';

const MODES = ['ripiega', 'avvolgi', 'taglia'];

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lo = v.param('lo');
    const hi = v.param('hi');
    const gain = v.param('gain');
    const mode = Math.round(v.param('mode'));
    const Y = (y: number) => h - 4 - ((y + 2) / 4) * (h - 8);
    g.fillStyle = '#16201a';
    g.fillRect(0, Y(Math.max(lo, hi)), w, Y(Math.min(lo, hi)) - Y(Math.max(lo, hi)));
    g.strokeStyle = C.value;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = -2 + (4 * i) / 100;
      const px = (i / 100) * w;
      const py = Y(foldWrap(x * gain, lo, hi, mode));
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    label(g, MODES[mode] ?? '', 3, 1);
  },
});

export default view;
