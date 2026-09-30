/** Noise (audio): l'oscilloscopio e il colore scelto. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { COLORS } from './index';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 2, w, h - 4, C.audio, 1 / Math.max(0.05, v.param('level')));
    label(g, COLORS[Math.round(v.param('color'))] ?? '', 3, 1);
  },
});

export default view;
