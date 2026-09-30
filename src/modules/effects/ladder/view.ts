/** Ladder: la curva di risposta (con la risonanza) e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { responseCurve } from '../filterView';
import { LADDER_MODES, ladderResponse } from './index';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, '#3a1a24');
    const mode = Math.round(v.param('mode'));
    responseCurve(g, w, h, (f) => ladderResponse(f, v.param('cutoff'), 4 * v.param('resonance'), mode));
    label(g, LADDER_MODES[mode] ?? '', 3, 1, C.text);
  },
});

export default view;
