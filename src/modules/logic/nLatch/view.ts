/** N-Latch: gli N stati in fila, quello attuale acceso, con un lampo al cambio. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 36,
  draw(g, w, h, v) {
    clear(g, w, h);
    const N = Math.max(2, Math.round(v.param('states')));
    const idx = Math.round(v.value('value') * (N - 1));
    const flash = v.events('trig', 0.12).length > 0;
    const cw = (w - 8) / N;
    for (let i = 0; i < N; i++) {
      g.fillStyle = i === idx ? (flash ? C.white : C.gate) : '#24242c';
      g.fillRect(4 + i * cw, 14, cw - 2, h - 18);
    }
    label(g, `stato ${idx + 1}/${N}`, 4, 1);
  },
});

export default view;
