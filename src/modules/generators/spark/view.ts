/** Spark: dove sta il knob (divisione e probabilità) e le scintille che escono. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';
import { sparkMap } from './index';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    const { division, prob } = sparkMap(v.param('spark'));
    roll(g, v.events('trig', 3), v.now, 3, 2, 12, w - 4, h - 14, C.event);
    label(g, `÷${division} · ${Math.round(prob * 100)}%`, 3, 1, C.white);
  },
});

export default view;
