/** Router: una corsia per uscita, con i colpi che ci sono andati. */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const N = Math.round(v.param('count'));
    lanes(
      g,
      w,
      h,
      v.now,
      3,
      Array.from({ length: N }, (_, k) => ({ label: String(k + 1), events: v.events(`out${k + 1}`, 3), color: C.event })),
    );
  },
});

export default view;
