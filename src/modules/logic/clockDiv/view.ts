/** Clock Divide / Multiply: il clock in ingresso e quello che esce. */

import { C, clear, label, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 3, [
      { label: 'in', events: v.input.events('trig', 3), color: '#777' },
      { label: 'out', events: v.events('trig', 3), color: C.event },
    ]);
    const d = Math.round(v.param('divide'));
    const m = Math.round(v.param('multiply'));
    label(g, `÷${d}${m > 1 ? ` ×${m}` : ''}`, w - 2, 1, C.white, 'right');
  },
});

export default view;
