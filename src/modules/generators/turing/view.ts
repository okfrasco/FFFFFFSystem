/**
 * Turing Machine: i bit del loop in fila (il primo a sinistra), il bit
 * appena invertito evidenziato, la freccia di rientro e il valore.
 */

import { C, clear, label, meter, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ bits: number[]; flipped: number }>();
    const len = Math.round(v.param('length'));
    const change = v.param('change');
    if (!st) {
      label(g, 'in attesa del clock', 3, 3);
      return;
    }
    const cell = Math.min(14, (w - 30) / len);
    const y = 16;
    for (let i = 0; i < len; i++) {
      const x = 4 + i * cell;
      g.fillStyle = st.bits[i] ? (i === st.flipped ? C.white : C.event) : '#22222a';
      g.fillRect(x, y, cell - 2, cell - 2);
      if (i < 8) {
        g.fillStyle = '#555';
        g.fillRect(x, y + cell, cell - 2, 1.5);
      }
    }
    // la freccia di rientro: dall'ultimo bit al primo
    g.strokeStyle = change > 0 ? C.gate : '#555';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(4 + (len - 0.5) * cell, y - 2);
    g.lineTo(4 + (len - 0.5) * cell, y - 6);
    g.lineTo(4 + 0.5 * cell, y - 6);
    g.lineTo(4 + 0.5 * cell, y - 2);
    g.stroke();
    meter(g, v.value('out'), w - 10, 4, 6, h - 8, C.value);
    label(g, change === 0 ? 'bloccato' : `change ${change.toFixed(2)}`, 4, h - 11, change === 0 ? C.white : C.text);
  },
});

export default view;
