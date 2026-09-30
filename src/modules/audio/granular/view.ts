/** Granulare: la nuvola (grani sparsi a caso nella zona di posizione e spray, fitti quanto la densità) e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { hash01 } from '../../../core/rng';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const pos = v.param('position');
    const spray = v.param('spray');
    const density = v.param('density');
    const size = v.param('size');
    // i grani degli ultimi 0.5 s, disegnati da un caso stabile nel tempo
    const n = Math.min(80, Math.round(density * 0.5));
    const t = Math.floor(v.now * density);
    for (let k = 0; k < n; k++) {
      const id = t - k;
      const x = Math.max(0, Math.min(1, pos + (hash01(3, id) * 2 - 1) * spray)) * w;
      const y = 6 + hash01(5, id) * (h - 26);
      const alpha = 1 - k / Math.max(1, n);
      g.fillStyle = `rgba(90,209,255,${alpha})`;
      g.fillRect(x, y, Math.max(1.5, size * 40), 2);
    }
    scope(g, v.scope('out'), 0, h - 18, w, 17, C.audio);
    label(g, v.param('source') >= 0.5 ? 'ingresso' : 'campione', 3, 1);
  },
});

export default view;
