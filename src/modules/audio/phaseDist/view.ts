/** Phase Distortion: la forma con la piega attuale (disegnata dai parametri) e il segnale vero. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { PD_SHAPES, pdSample } from './index';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const shape = Math.round(v.param('shape'));
    const a = v.param('amount');
    g.strokeStyle = '#4a2a32';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = (i / 120) * 1.5;
      const y = h / 2 - pdSample(shape, p - Math.floor(p), a) * (h / 2 - 6);
      if (i === 0) g.moveTo((i / 120) * w, y);
      else g.lineTo((i / 120) * w, y);
    }
    g.stroke();
    scope(g, v.scope('out'), 0, 3, w, h - 6, C.audio, 1 / Math.max(0.05, v.param('level')));
    label(g, `${PD_SHAPES[shape] ?? ''} · ${Math.round(a * 100)}%`, 3, 2);
  },
});

export default view;
