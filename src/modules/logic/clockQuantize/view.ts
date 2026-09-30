/** Clock Quantize: i colpi in ingresso, il clock, e i colpi spostati sul clock. */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 3, [
      { label: 'in', events: v.input.events('in', 3), color: '#777' },
      { label: 'clk', events: v.input.events('clock', 3), color: '#445' },
      { label: 'out', events: v.events('trig', 3), color: C.event },
    ]);
  },
});

export default view;
