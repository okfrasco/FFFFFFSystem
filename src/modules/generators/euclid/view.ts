/**
 * Euclideo: il cerchio degli step con gli impulsi accesi (rotazione compresa);
 * lo step corrente gira con la fase, i colpi appena suonati si illuminano.
 */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { bjorklund } from './index';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const steps = Math.max(1, Math.round(v.param('steps')));
    const pulses = Math.round(v.param('pulses'));
    const rot = Math.round(v.param('rotate'));
    const pattern = bjorklund(pulses, steps);
    const pos = Math.floor(frac(v.input.value('phase')) * steps);
    const recent = v.events('trig', 0.12).length > 0;
    const cx = h / 2;
    const cy = h / 2;
    const r = h / 2 - 7;
    // il poligono che unisce gli impulsi: la "forma" del ritmo
    g.strokeStyle = '#4a3522';
    g.lineWidth = 1;
    g.beginPath();
    let first = true;
    for (let i = 0; i < steps; i++) {
      if (!pattern[(((i - rot) % steps) + steps) % steps]) continue;
      const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (first) g.moveTo(x, y);
      else g.lineTo(x, y);
      first = false;
    }
    g.closePath();
    g.stroke();
    for (let i = 0; i < steps; i++) {
      const on = pattern[(((i - rot) % steps) + steps) % steps];
      const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const here = i === pos;
      g.fillStyle = on ? (here && recent ? C.white : C.event) : here ? '#444' : '#222';
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, here ? 4 : on ? 3 : 2, 0, Math.PI * 2);
      g.fill();
    }
    label(g, `E(${pulses},${steps})${rot ? ` +${rot}` : ''}`, h + 6, 8, C.white);
    const m = v.param('mutation');
    if (m > 0) label(g, `mutazione ${m.toFixed(2)}`, h + 6, 22);
  },
});

export default view;
