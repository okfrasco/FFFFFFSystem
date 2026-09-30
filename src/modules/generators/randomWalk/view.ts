/** Random walk: la traccia degli ultimi 6 secondi dentro i suoi limiti, con il centro. */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const y = (x: number) => h - 3 - x * (h - 6);
    const lo = Math.min(v.param('lo'), v.param('hi'));
    const hi = Math.max(v.param('lo'), v.param('hi'));
    g.fillStyle = '#16201a';
    g.fillRect(0, y(hi), w, y(lo) - y(hi));
    g.fillStyle = '#39402a';
    g.fillRect(0, y(v.param('center')) - 0.5, w, 1);
    sparkline(g, v.history('out', 6, 150), 0, 3, w - 6, h - 6, C.value, 0, 1);
    const now = v.value('out');
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(w - 4, y(now), 3, 0, Math.PI * 2);
    g.fill();
    label(g, now.toFixed(2), 3, 1);
  },
});

export default view;
