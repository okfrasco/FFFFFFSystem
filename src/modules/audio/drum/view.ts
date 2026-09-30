/** Drum voice: il suono che esce, con il tipo e un lampo a ogni colpo. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { DRUM_TYPES } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const hit = v.input.events('trig', 0.15).at(-1);
    if (hit) {
      g.fillStyle = C.audio;
      g.globalAlpha = 0.25 * (1 - (v.now - hit.t) / 0.15);
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    const level = Math.max(0.05, v.param('level'));
    scope(g, v.scope('out'), 0, 2, w, h - 4, C.audio, 1 / level);
    label(g, DRUM_TYPES[Math.round(v.param('type'))] ?? '', 3, 2, C.white);
  },
});

export default view;
