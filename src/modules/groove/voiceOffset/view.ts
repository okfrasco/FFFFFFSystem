/** Offset per voce: per ogni corsia, di quanto è avanti (sinistra) o dietro (destra) il tempo. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const mid = w / 2;
    g.fillStyle = C.grid;
    g.fillRect(mid, 0, 1, h);
    for (let k = 1; k <= 4; k++) {
      const off = v.param(`off${k}`);
      const y = 2 + (k - 1) * ((h - 4) / 4);
      const hit = v.events(`out${k}`, 0.12).length > 0;
      const x = mid + (off / 60) * (mid - 20);
      g.fillStyle = hit ? C.white : C.event;
      g.fillRect(Math.min(mid, x), y + 2, Math.abs(x - mid) || 1, (h - 4) / 4 - 4);
      label(g, `${k}`, 2, y + 1, C.dim);
      label(g, `${off > 0 ? '+' : ''}${Math.round(off)}`, w - 2, y + 1, C.text, 'right');
    }
  },
});

export default view;
