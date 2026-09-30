/** Logic Delay: il gate in ingresso e quello ritardato. */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 3, [
      { label: 'in', history: v.input.history('gate', 3, 120), events: v.input.events('gate', 3), color: '#777' },
      { label: 'out', history: v.history('gate', 3, 120), color: C.gate },
    ]);
  },
});

export default view;
