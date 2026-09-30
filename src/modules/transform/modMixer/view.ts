/** Mod Mixer: il contributo di ogni ingresso (peso × valore, sopra o sotto lo zero) e la somma. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const mid = h / 2;
    const cw = w / 5;
    const bar = (i: number, val: number, color: string) => {
      const hh = Math.max(-1, Math.min(1, val)) * (h / 2 - 4);
      g.fillStyle = color;
      g.fillRect(i * cw + cw * 0.25, hh > 0 ? mid - hh : mid, cw * 0.5, Math.abs(hh) || 1);
    };
    g.fillStyle = C.grid;
    g.fillRect(0, mid, w, 1);
    for (let k = 1; k <= 4; k++) bar(k - 1, v.param(`amt${k}`) * v.input.value(`in${k}`), C.value);
    bar(4, v.value('out'), C.white);
    label(g, 'Σ', 4 * cw + cw / 2, 1, C.text, 'center');
  },
});

export default view;
