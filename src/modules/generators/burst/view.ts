/** Burst: la forma della raffica (distanze e velocity) e i colpi che escono. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';
import { burstTimes } from './index';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const count = Math.round(v.param('count'));
    const times = burstTimes(count, 1, v.param('accel'));
    const total = Math.max(1e-6, times.at(-1)!);
    const decay = v.param('decay');
    const bw = w * 0.45;
    times.forEach((t, i) => {
      const vel = Math.pow(1 - decay, i);
      g.fillStyle = C.event;
      g.globalAlpha = 0.3 + 0.7 * vel;
      g.fillRect(4 + (t / total) * (bw - 8), 6 + (h - 12) * (1 - vel), 2, (h - 12) * vel);
    });
    g.globalAlpha = 1;
    roll(g, v.events('trig', 2), v.now, 2, bw, 4, w - bw - 4, h - 8, C.event);
    label(g, `×${count}`, 4, 1);
  },
});

export default view;
