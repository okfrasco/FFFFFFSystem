/** Counter: i colpi contati come tacche piene fino alla soglia, e il lampo quando scatta. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 32,
  draw(g, w, h, v) {
    clear(g, w, h);
    const N = Math.max(1, Math.round(v.param('threshold')));
    const c = Math.round(v.value('count') * N);
    const fired = v.events('trig', 0.15).length > 0;
    const cw = Math.min(14, (w - 8) / N);
    for (let i = 0; i < N; i++) {
      g.fillStyle = fired ? C.white : i < c ? C.event : '#24242c';
      g.fillRect(4 + i * cw, 14, cw - 2, h - 18);
    }
    label(g, `${c}/${N}`, 4, 1);
  },
});

export default view;
