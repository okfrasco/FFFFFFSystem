/** Latch: i trigger (sopra) e lo stato che accendono e spengono (sotto). */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 4, [
      { label: 'T', events: v.input.events('trig', 4), color: C.event },
      { label: '▮', history: v.history('gate', 4, 100), color: C.gate },
    ]);
  },
});

export default view;
