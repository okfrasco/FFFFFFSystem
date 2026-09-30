/** Delay: le ripetizioni nei prossimi 2 secondi, alte quanto il feedback le lascia, e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const time = v.param('time');
    const fb = v.param('feedback');
    const mix = v.param('mix');
    const span = 2;
    const barH = h - 14;
    g.fillStyle = C.dim;
    g.fillRect(1, 2, 2, barH * (1 - mix));
    let amp = mix;
    for (let t = time; t < span; t += time) {
      const x = (t / span) * w;
      g.fillStyle = C.audio;
      g.globalAlpha = 0.3 + 0.7 * amp;
      g.fillRect(x - 1, 2 + barH * (1 - amp), 2, barH * amp);
      amp *= fb;
      if (amp < 0.01) break;
    }
    g.globalAlpha = 1;
    scope(g, v.scope('out'), 0, h - 12, w, 11, '#7a2a3a');
    label(g, `${Math.round(time * 1000)} ms · fb ${fb.toFixed(2)}`, w - 2, 2, C.text, 'right');
  },
});

export default view;
