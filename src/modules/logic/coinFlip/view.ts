/** Coin Flip: i colpi che vanno ad A (sopra) e a B (sotto), con la probabilità. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    roll(g, v.events('a', 3), v.now, 3, 14, 2, w - 16, h / 2 - 3, C.event);
    roll(g, v.events('b', 3), v.now, 3, 14, h / 2 + 1, w - 16, h / 2 - 3, C.gate);
    label(g, 'A', 2, 4, C.event);
    label(g, 'B', 2, h / 2 + 4, C.gate);
    g.fillStyle = C.grid;
    g.fillRect(14, h / 2 - 0.5, w - 16, 1);
    label(g, `${Math.round(v.param('prob') * 100)}%`, w - 2, 2, C.white, 'right');
  },
});

export default view;
