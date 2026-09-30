/** Dinamica: la curva ingresso → uscita con la soglia, e la riduzione di guadagno attuale. */

import { C, clear, label, meter, type ViewFactory } from '../../../ui/editor/viewKit';
import { DYN_MODES, transfer } from './index';

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const mode = Math.round(v.param('mode'));
    const size = h - 6;
    const X = (db: number) => 3 + ((db + 60) / 60) * size;
    const Y = (db: number) => h - 3 - ((db + 60) / 60) * size;
    g.strokeStyle = '#26262e';
    g.beginPath();
    g.moveTo(X(-60), Y(-60));
    g.lineTo(X(0), Y(0));
    g.stroke();
    if (mode !== 2) {
      const thr = v.param('threshold');
      const ratio = mode === 1 ? 1000 : v.param('ratio');
      g.strokeStyle = C.audio;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let db = -60; db <= 0; db += 1) {
        const y = Y(transfer(db, thr, ratio, mode === 1 ? 0.5 : 6));
        if (db === -60) g.moveTo(X(db), y);
        else g.lineTo(X(db), y);
      }
      g.stroke();
    }
    const gr = v.scope('gr');
    const red = gr ? Math.max(...gr.samples) : 0;
    meter(g, red, w - 10, 4, 6, h - 8, C.event);
    label(g, DYN_MODES[mode] ?? '', size + 10, 1, C.text);
    label(g, `−${(-20 * Math.log10(Math.max(1e-3, 1 - red))).toFixed(1)} dB`, size + 10, 14, C.white);
  },
});

export default view;
