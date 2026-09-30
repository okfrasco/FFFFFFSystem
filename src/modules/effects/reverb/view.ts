/** Reverb: la coda (T60) e l'uscita stereo, sinistra sopra e destra sotto. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const t60 = v.param('decay');
    const span = Math.max(2, t60 * 1.2);
    g.fillStyle = '#3a1a24';
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= 60; i++) {
      const t = (span * i) / 60;
      g.lineTo((i / 60) * w, h - Math.exp((-6.9 * t) / t60) * (h - 4) * v.param('mix') * 1.5);
    }
    g.lineTo(w, h);
    g.fill();
    scope(g, v.scope('out'), 0, 4, w, h - 8, C.audio);
    label(g, `T60 ${t60.toFixed(1)} s`, w - 2, 2, C.text, 'right');
  },
});

export default view;
