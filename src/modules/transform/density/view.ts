/** Densità: i colpi in ingresso (sopra), quelli che escono (sotto), e la soglia o i ghost. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    roll(g, v.input.events('in', 3), v.now, 3, 2, 3, w - 4, h / 2 - 5, '#666');
    roll(g, v.events('out', 3), v.now, 3, 2, h / 2 + 2, w - 4, h / 2 - 5, C.event);
    const d = v.param('density');
    label(g, d < 0.5 ? `soglia ${((0.5 - d) * 2).toFixed(2)}` : d > 0.5 ? `ghost ${Math.round((d - 0.5) * 200)}%` : 'passa tutto', w - 2, 1, C.text, 'right');
  },
});

export default view;
