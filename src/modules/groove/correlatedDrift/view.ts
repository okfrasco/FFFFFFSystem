/** Drift correlato: lo scarto degli ultimi 8 secondi (sopra = in ritardo) e i colpi che escono. */

import { C, clear, label, roll, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = Math.max(1, v.param('amount'));
    g.fillStyle = C.grid;
    g.fillRect(0, (h - 8) / 2, w, 1);
    sparkline(g, v.history('offset', 8, 120), 2, 2, w - 4, h - 12, C.phase, -a, a);
    roll(g, v.events('out', 8), v.now, 8, 2, h - 7, w - 4, 6, C.event);
    label(g, `±${Math.round(a)} ms`, 3, 0);
  },
});

export default view;
