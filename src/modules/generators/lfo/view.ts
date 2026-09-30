/** LFO: due cicli della forma, con il punto dove si trova adesso. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { LFO_SHAPES, lfoShape } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const shape = Math.round(v.param('shape'));
    const skew = v.param('skew');
    const cycles = v.param('cycles');
    const pos = frac(v.input.value('phase') * cycles + v.param('offset'));
    const y = (val: number) => h - 4 - val * (h - 8);
    g.strokeStyle = C.value;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = (i / 120) * 2;
      const py = y(lfoShape(shape, u - Math.floor(u), skew));
      if (i === 0) g.moveTo((i / 120) * w, py);
      else g.lineTo((i / 120) * w, py);
    }
    g.stroke();
    const x = ((1 + pos) / 2) * w;
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(x, y(lfoShape(shape, pos, skew)), 3, 0, Math.PI * 2);
    g.fill();
    label(g, `${LFO_SHAPES[shape]} × ${cycles >= 1 ? cycles.toFixed(2) : `1/${(1 / cycles).toFixed(1)}`}`, 3, 1);
  },
});

export default view;
