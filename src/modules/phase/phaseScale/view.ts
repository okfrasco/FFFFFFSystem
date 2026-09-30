/** Ø Scale: la fase in ingresso e quella in uscita, affiancate, con il rapporto. */

import { C, clear, frac, label, ring, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const r = h / 2 - 5;
    ring(g, h / 2, h / 2, r, frac(v.input.value('in')), C.dim, 2);
    ring(g, h + h / 2, h / 2, r, frac(v.value('out')), C.phase, 3);
    label(g, `× ${v.param('num')}/${v.param('den')}`, 2 * h + 6, h / 2 - 5, C.white);
  },
});

export default view;
