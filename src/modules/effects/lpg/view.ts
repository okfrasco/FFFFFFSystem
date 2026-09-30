/** Low-pass gate: l'apertura del vactrol nel tempo e il segnale. */

import { C, clear, label, meter, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { LPG_MODES } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lv = v.scope('level');
    const level = lv ? Math.max(...lv.samples) : 0;
    meter(g, level, 2, 4, 6, h - 8, C.value);
    scope(g, v.scope('out'), 12, 4, w - 14, h - 8, C.audio);
    label(g, LPG_MODES[Math.round(v.param('mode'))] ?? '', w - 3, 1, C.text, 'right');
  },
});

export default view;
