/** Transport: anello della battuta con i beat, numero di battuta e BPM. */

import { C, clear, frac, label, ring, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const bar = v.value('bar');
    const meter = Math.max(1, Math.round(v.param('meter')));
    const r = h / 2 - 5;
    const cx = h / 2;
    const cy = h / 2;
    ring(g, cx, cy, r, frac(bar), C.phase, 3);
    const beat = Math.floor(frac(bar) * meter);
    for (let b = 0; b < meter; b++) {
      const a = -Math.PI / 2 + (b / meter) * Math.PI * 2;
      g.fillStyle = b === beat ? C.white : C.dim;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, b === beat ? 3.5 : 2, 0, Math.PI * 2);
      g.fill();
    }
    g.font = '16px ui-monospace, Menlo, monospace';
    g.fillStyle = C.white;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(`${Math.floor(bar) + 1}.${beat + 1}`, h + 6, h / 2 - 6);
    label(g, `${v.param('bpm').toFixed(1)} bpm · ${meter}/4`, h + 6, h / 2 + 6);
  },
});

export default view;
