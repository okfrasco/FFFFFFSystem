/**
 * Pan: la posizione sull'asse stereo (sinistra → destra), il ventaglio in
 * cui si aprono le voci (cinque punti d'esempio) e il segnale dei due canali.
 */

import { C, clear, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { voicePos } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, h / 2, w, h / 2 - 2, C.audio);
    const n = 5;
    g.strokeStyle = '#26262e';
    g.beginPath();
    g.moveTo(8, 12);
    g.lineTo(w - 8, 12);
    g.stroke();
    for (let k = 0; k < n; k++) {
      const p = Math.max(-1, Math.min(1, voicePos(k, n, v.param('pan'), v.param('spread'))));
      g.fillStyle = C.white;
      g.beginPath();
      g.arc(8 + ((p + 1) / 2) * (w - 16), 12, 3, 0, Math.PI * 2);
      g.fill();
    }
  },
});

export default view;
