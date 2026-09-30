/** Gate Repeat: il gate in ingresso e la raffica di trigger che produce. */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 2, [
      { label: '▮', history: v.input.history('gate', 2, 120), color: C.gate },
      { label: 'T', events: v.events('trig', 2), color: C.event },
    ]);
  },
});

export default view;
