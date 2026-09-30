/**
 * Mappa logistica: il diagramma a ragnatela — la parabola r·x·(1−x), la
 * diagonale, e il percorso degli ultimi step che ci rimbalza tra le due.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const r = v.param('r');
    const hist = v.state<{ history: number[] }>()?.history ?? [];
    const s = h - 6;
    const X = (x: number) => 3 + x * s;
    const Y = (y: number) => 3 + s - y * s;
    g.strokeStyle = C.grid;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(1), Y(1));
    g.stroke();
    g.strokeStyle = '#3a4a2a';
    g.beginPath();
    for (let i = 0; i <= 50; i++) {
      const x = i / 50;
      if (i === 0) g.moveTo(X(x), Y(r * x * (1 - x)));
      else g.lineTo(X(x), Y(r * x * (1 - x)));
    }
    g.stroke();
    g.strokeStyle = C.value;
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < hist.length; i++) {
      const a = hist[i - 1]!;
      const b = hist[i]!;
      if (i === 1) g.moveTo(X(a), Y(a));
      g.lineTo(X(a), Y(b));
      g.lineTo(X(b), Y(b));
    }
    g.stroke();
    label(g, `r ${r.toFixed(3)}`, s + 10, 4, C.white);
    label(g, r < 3 ? 'stabile' : r < 3.449 ? 'periodo 2' : r < 3.5699 ? 'raddoppi' : 'caos', s + 10, 18);
  },
});

export default view;
