/** Comb: i picchi (o i buchi) sulla scala delle frequenze, e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { responseCurve } from '../filterView';
import { COMB_MODES, combResponse } from './index';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, '#3a1a24');
    const mode = Math.round(v.param('mode'));
    const f0 = v.param('freq');
    responseCurve(g, w, h, (f) => combResponse(f, f0, v.param('feedback'), mode));
    label(g, `${COMB_MODES[mode]} · ${Math.round(f0)} Hz`, 3, 1, C.text);
  },
});

export default view;
