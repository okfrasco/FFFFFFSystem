/** Gate Length: i trigger (sopra) e i gate che diventano (sotto). */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 2, [
      { label: 'T', events: v.input.events('trig', 2), color: C.event },
      { label: '▮', history: v.history('gate', 2, 120), color: C.gate },
    ]);
  },
});

export default view;
