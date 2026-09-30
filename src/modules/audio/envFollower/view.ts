/** Envelope follower: l'inviluppo degli ultimi 4 secondi e il livello adesso. */

import { C, clear, meter, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const hist = v.history('out', 4, 100);
    const hi = Math.max(1, ...hist);
    sparkline(g, hist, 2, 3, w - 16, h - 6, C.value, 0, hi);
    meter(g, v.value('out') / hi, w - 9, 3, 6, h - 6, C.value);
  },
});

export default view;
