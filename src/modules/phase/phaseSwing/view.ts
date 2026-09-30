/**
 * Ø Swing: gli step di un ciclo su una riga, dritti (sotto, grigi) e con lo
 * swing (sopra); il cursore è la posizione adesso.
 */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { swingWarp } from './index';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    const amount = v.param('amount');
    const div = Math.max(2, Math.round(v.param('division')));
    const x = (f: number) => 4 + f * (w - 8);
    for (let i = 0; i < div; i++) {
      // dove cade lo step i dopo lo swing: la posizione di ingresso che dà i/div in uscita
      const straight = i / div;
      const pair = Math.floor(i / 2);
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (swingWarp(mid, amount) < (i % 2) * 0.5) lo = mid;
        else hi = mid;
      }
      const swung = (pair + (i % 2 === 0 ? 0 : hi)) / (div / 2);
      g.fillStyle = '#333';
      g.fillRect(x(straight) - 0.5, h - 14, 1, 8);
      g.fillStyle = i % 2 ? C.event : C.white;
      g.fillRect(x(swung) - 1, 14, 2, 12);
    }
    const now = frac(v.input.value('in'));
    g.fillStyle = C.phase;
    g.fillRect(x(now) - 0.5, 10, 1, h - 16);
    label(g, `swing ${amount.toFixed(2)} · ${div}`, 4, 1);
  },
});

export default view;
