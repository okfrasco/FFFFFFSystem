/** Voice leading: le voci come linee nel tempo (ultimi 12 secondi), e l'accordo attuale. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { chordLabel } from '../draw';

const view: ViewFactory = () => ({
  height: 60,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lo = v.param('lo') - 14;
    const hi = v.param('hi') + 2;
    const Y = (p: number) => h - 2 - ((p - lo) / (hi - lo)) * (h - 14);
    const seconds = 12;
    const X = (t: number) => w - 2 - ((v.now - t) / seconds) * (w - 4);
    // ogni nota suonata è un segmento lungo quanto la Durata
    for (const e of v.events('note', seconds)) {
      const x0 = X(e.t);
      const x1 = Math.min(w - 2, X(e.t + v.param('length')));
      g.fillStyle = e.voice === 0 && v.param('bass') >= 0.5 ? C.white : C.value;
      g.fillRect(x0, Y(e.v) - 1, Math.max(1.5, x1 - x0), 2);
    }
    label(g, chordLabel(v.voices('chord').filter((p) => p > 0)), 3, 0, C.white);
  },
});

export default view;
