/** Ø Drift: lo scarto di ogni voce negli ultimi 8 secondi (sopra la linea = in anticipo). */

import { C, clear, label, sparkline, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const amount = Math.max(1e-4, v.param('amount'));
    g.fillStyle = C.grid;
    g.fillRect(0, h / 2, w, 1);
    sparkline(g, v.history('offset', 8, 120), 2, 4, w - 4, h - 8, C.phase, -amount, amount);
    const now = v.voices('offset');
    now.forEach((o, i) => {
      g.fillStyle = i === 0 ? C.white : C.phase;
      g.beginPath();
      g.arc(w - 5, h / 2 - (o / amount) * (h / 2 - 4), 2.5, 0, Math.PI * 2);
      g.fill();
    });
    label(g, `±${amount.toFixed(3)} cicli · ${v.param('rate').toFixed(2)} Hz`, 3, 1);
  },
});

export default view;
