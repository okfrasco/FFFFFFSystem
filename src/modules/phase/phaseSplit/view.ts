/** Ø Split: un cerchio con un punto per voce, sfasati come escono. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const phases = v.voices('out');
    const cx = h / 2;
    const cy = h / 2;
    const r = h / 2 - 6;
    g.strokeStyle = C.grid;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    phases.forEach((p, i) => {
      const a = -Math.PI / 2 + frac(p) * Math.PI * 2;
      g.fillStyle = i === 0 ? C.white : C.phase;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
      g.fill();
    });
    label(g, `${phases.length} voci · spread ${v.param('spread').toFixed(2)}`, h + 6, h / 2 - 5);
  },
});

export default view;
