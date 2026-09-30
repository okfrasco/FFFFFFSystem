/** Shift: di quanto sposta (freccia su o giù, più lunga con il feedback) e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, C.audio);
    const pitch = v.param('mode') >= 0.5;
    const amt = pitch ? v.param('semitones') / 24 : v.param('shift') / 1000;
    const fb = v.param('feedback');
    const len = (h / 2 - 4) * Math.abs(amt) * (1 + fb * 2);
    g.fillStyle = C.white;
    g.fillRect(w - 10, h / 2 - (amt > 0 ? len : 0), 3, Math.max(1, len));
    label(g, pitch ? `${v.param('semitones').toFixed(1)} st` : `${Math.round(v.param('shift'))} Hz`, 3, 1, C.text);
  },
});

export default view;
