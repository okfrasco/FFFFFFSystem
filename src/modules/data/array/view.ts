/** Array: la tabella registrata, la cella letta adesso e, in rosso, quando registra. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import type { ArrayState } from './index';

const view: ViewFactory = () => ({
  height: 56,
  draw(g, w, h, v) {
    clear(g, w, h);
    const table = v.state<ArrayState>()?.table ?? [];
    const n = Math.max(1, table.length);
    let lo = 0;
    let hi = 1;
    for (const x of table) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    const rec = v.param('record') >= 0.5 || v.input.value('rec') > 0.5;
    const cur = Math.floor(frac(v.input.value('phase')) * n);
    const cw = (w - 4) / n;
    const Y = (x: number) => h - 3 - ((x - lo) / (hi - lo || 1)) * (h - 14);
    table.forEach((x, i) => {
      g.fillStyle = i === cur ? (rec ? '#ff4d5e' : C.white) : C.value;
      const y0 = Y(Math.max(lo, 0));
      const y1 = Y(x);
      g.fillRect(2 + i * cw, Math.min(y0, y1), Math.max(1, cw - 1), Math.max(1, Math.abs(y1 - y0)));
    });
    label(g, rec ? '● rec' : `${table.length} celle`, 3, 0, rec ? '#ff4d5e' : C.text);
    label(g, `${lo.toFixed(1)}…${hi.toFixed(1)}`, w - 3, 0, C.dim, 'right');
  },
});

export default view;
