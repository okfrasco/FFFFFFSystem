/** Spettrale: la curva di guadagno per banda (tilt e tagli), il freeze e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { responseCurve } from '../filterView';
import { N, binGain } from './index';

const view: ViewFactory = () => ({
  height: 50,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, '#3a1a24');
    const sr = 48000;
    const s = {
      freeze: v.param('freeze') >= 0.5,
      smear: v.param('smear'),
      blur: v.param('blur'),
      tilt: v.param('tilt'),
      lowBin: Math.floor((v.param('lowCut') / sr) * N),
      highBin: Math.ceil((v.param('highCut') / sr) * N),
    };
    responseCurve(g, w, h, (f) => binGain(Math.round((f / sr) * N), s) || 1e-6);
    if (s.freeze) label(g, '❄ freeze', w - 3, 1, C.white, 'right');
    label(g, `smear ${Math.round(s.smear * 100)}%`, 3, 1, C.text);
  },
});

export default view;
