/**
 * Clock: una tacca per step intorno al cerchio (gli step dispari spostati
 * dallo swing), lo step corrente acceso, e l'arco del gate aperto.
 */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const div = Math.max(1, Math.round(v.param('division')));
    const swing = v.param('swing');
    const offset = v.param('offset');
    const gateLen = v.param('gate');
    const phase = v.input.value('phase');
    const cx = h / 2;
    const cy = h / 2;
    const r = h / 2 - 6;
    // posizione di ogni step sul cerchio, con swing e offset
    const at = (i: number) => (i + (i % 2 === 1 ? 0.5 * Math.max(-1, Math.min(1, swing)) : 0) + offset) / div;
    const cur = Math.floor(frac(phase - offset / div) * div);
    const open = v.value('gate') >= 0.5;
    if (open) {
      g.strokeStyle = C.gate;
      g.lineWidth = 3;
      g.beginPath();
      const a0 = -Math.PI / 2 + at(cur) * Math.PI * 2;
      g.arc(cx, cy, r, a0, a0 + (gateLen / div) * Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < div; i++) {
      const a = -Math.PI / 2 + at(i) * Math.PI * 2;
      const here = i === cur;
      g.strokeStyle = here ? C.white : i === 0 ? C.event : '#444';
      g.lineWidth = here ? 2.5 : 1.5;
      const r0 = here ? r - 7 : r - 4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
      g.stroke();
    }
    g.fillStyle = open ? C.gate : '#26262e';
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fill();
    label(g, `÷ ${div}`, h + 6, 8, C.white);
    label(g, `step ${cur + 1}`, h + 6, 22);
    if (swing !== 0) label(g, `swing ${swing.toFixed(2)}`, h + 6, 36);
  },
});

export default view;
