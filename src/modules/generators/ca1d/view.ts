/** Automa 1D: le ultime generazioni una sotto l'altra (la più nuova in basso), con la cella letta. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 72,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ history: number[][] }>();
    if (!st?.history.length) return;
    const rows = st.history;
    const width = rows[0]!.length;
    const cw = w / width;
    const ch = (h - 10) / 32;
    const cell = Math.round(v.param('cell')) % width;
    rows.forEach((r, y) => {
      const py = 10 + (32 - rows.length + y) * ch;
      r.forEach((c, x) => {
        if (!c) return;
        g.fillStyle = x === cell ? C.white : y === rows.length - 1 ? C.event : '#8a5a2a';
        g.fillRect(x * cw, py, Math.max(1, cw - 0.5), Math.max(1, ch - 0.3));
      });
    });
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(cell * cw, 10, cw, h - 10);
    label(g, `regola ${Math.round(v.param('rule'))}`, 3, 0, C.white);
  },
});

export default view;
