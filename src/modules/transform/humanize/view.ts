/** Humanize: i colpi in ingresso (sopra) e quelli spostati (sotto), sullo stesso tempo. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    roll(g, v.input.events('in', 1.5), v.now, 1.5, 2, 3, w - 4, h / 2 - 5, '#666');
    roll(g, v.events('out', 1.5), v.now, 1.5, 2, h / 2 + 2, w - 4, h / 2 - 5, C.event);
    label(g, `±${Math.round(v.param('time') * 1000)} ms`, w - 2, 1, C.text, 'right');
  },
});

export default view;
