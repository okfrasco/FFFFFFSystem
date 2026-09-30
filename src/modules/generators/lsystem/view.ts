/**
 * L-system: la stringa disegnata come tartaruga (F avanti, + − gira, [ ]
 * ramo); il tratto già letto nella passata corrente è acceso.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { expandLSystem, type LSystemConfig } from './index';

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  i: number;
}

function turtle(str: string): Seg[] {
  const segs: Seg[] = [];
  let x = 0;
  let y = 0;
  let a = -Math.PI / 2;
  const stack: [number, number, number][] = [];
  const turn = (25 * Math.PI) / 180;
  for (let i = 0; i < str.length; i++) {
    const c = str[i]!;
    if (c >= 'A' && c <= 'Z') {
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, i });
      x = nx;
      y = ny;
    } else if (c === 'f' || c === '.') {
      x += Math.cos(a);
      y += Math.sin(a);
    } else if (c === '+') a += turn;
    else if (c === '-') a -= turn;
    else if (c === '[') stack.push([x, y, a]);
    else if (c === ']') [x, y, a] = stack.pop() ?? [x, y, a];
  }
  return segs;
}

const view: ViewFactory = () => {
  let key = '';
  let segs: Seg[] = [];
  let bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  return {
    height: 80,
    draw(g, w, h, v) {
      clear(g, w, h);
      const cfg = v.config<LSystemConfig>();
      const it = Math.round(v.param('iterations'));
      const k = JSON.stringify(cfg) + it;
      if (k !== key) {
        key = k;
        segs = turtle(expandLSystem(cfg, it));
        bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
        for (const s of segs) {
          bounds.x0 = Math.min(bounds.x0, s.x1, s.x2);
          bounds.x1 = Math.max(bounds.x1, s.x1, s.x2);
          bounds.y0 = Math.min(bounds.y0, s.y1, s.y2);
          bounds.y1 = Math.max(bounds.y1, s.y1, s.y2);
        }
      }
      const pos = v.state<{ pos: number }>()?.pos ?? 0;
      const bw = Math.max(1e-6, bounds.x1 - bounds.x0);
      const bh = Math.max(1e-6, bounds.y1 - bounds.y0);
      const s = Math.min((w - 8) / bw, (h - 8) / bh);
      const ox = (w - bw * s) / 2 - bounds.x0 * s;
      const oy = (h - bh * s) / 2 - bounds.y0 * s;
      g.lineWidth = 1.2;
      for (const sg of segs) {
        g.strokeStyle = sg.i < pos ? C.event : '#3a3024';
        g.beginPath();
        g.moveTo(ox + sg.x1 * s, oy + sg.y1 * s);
        g.lineTo(ox + sg.x2 * s, oy + sg.y2 * s);
        g.stroke();
      }
      label(g, `${segs.length} note`, 3, 2);
    },
  };
};

export default view;
