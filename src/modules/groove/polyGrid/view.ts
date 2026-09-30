/** Griglia polimetrica: una riga per corsia, con i suoi step e la posizione attuale. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lanes = Math.round(v.param('lanes'));
    const phases = v.voices('phase');
    const rh = (h - 2) / lanes;
    for (let i = 0; i < lanes; i++) {
      const len = Math.round(v.param(`len${i + 1}`));
      const div = Math.round(v.param(`div${i + 1}`));
      const pos = Math.floor(frac(phases[i] ?? 0) * len);
      const cw = (w - 44) / len;
      for (let s = 0; s < len; s++) {
        g.fillStyle = s === pos ? C.white : s === 0 ? C.event : '#26262e';
        g.fillRect(44 + s * cw, 1 + i * rh + 1, Math.max(1, cw - 1), rh - 3);
      }
      label(g, `${len}/${div}`, 2, 1 + i * rh + rh / 2 - 5, C.text);
    }
  },
});

export default view;
