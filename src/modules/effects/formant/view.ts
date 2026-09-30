/** Formanti: le tre formanti sulla scala delle frequenze e la vocale attuale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { VOWELS, formantsAt } from './index';

const view: ViewFactory = () => ({
  height: 50,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, '#3a1a24');
    const vw = v.param('vowel');
    const X = (f: number) => (Math.log(f / 100) / Math.log(50)) * w;
    formantsAt(vw, v.param('shift')).forEach((f, k) => {
      const bw = Math.max(3, 40 / v.param('q'));
      g.fillStyle = `rgba(255,120,150,${0.9 - k * 0.25})`;
      g.fillRect(X(f) - bw / 2, 10 + k * 6, bw, h - 16 - k * 6);
    });
    const i = Math.round(vw);
    label(g, VOWELS[i] ?? '', 3, 1, C.white);
  },
});

export default view;
