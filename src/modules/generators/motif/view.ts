/** Motif: la cella originale (sopra, grigia) e la variante che sta suonando (sotto), con il nome della trasformazione. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { TRANSFORMS, type Cell } from './index';

function drawCell(g: CanvasRenderingContext2D, cell: Cell, x: number, y: number, w: number, h: number, color: string, lo: number, hi: number) {
  const cw = w / cell.length;
  cell.forEach((d, i) => {
    if (d === null) return;
    g.fillStyle = color;
    g.fillRect(x + i * cw + 1, y + (1 - (d - lo) / (hi - lo)) * (h - 3), cw - 2, 3);
  });
}

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ cell: Cell; current: Cell; kind: number; rep: number }>();
    if (!st) return;
    const all = [...st.cell, ...st.current].filter((d): d is number => d !== null);
    const lo = Math.min(...all) - 1;
    const hi = Math.max(...all) + 1;
    drawCell(g, st.cell, 0, 12, w, (h - 14) / 2, '#666', lo, hi);
    drawCell(g, st.current, 0, 12 + (h - 14) / 2, w, (h - 14) / 2, st.kind ? C.event : C.white, lo, hi);
    label(g, `rip. ${st.rep + 1} · ${TRANSFORMS[st.kind]}`, 2, 0, C.white);
  },
});

export default view;
