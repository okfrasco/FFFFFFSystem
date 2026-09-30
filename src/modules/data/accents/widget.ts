/**
 * Celle di Accents: clic per ciclare pausa → normale → accento, trascina per
 * dipingere lo stesso stato su più celle. −/+ cambiano la lunghezza.
 */

import type { AccentsConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf, inputPhase, onDrag } from '../../../ui/editor/widgetKit';

export default function accentsWidget(api: EditorApi, nodeId: string): Widget {
  const cfg = () => configOf<AccentsConfig>(api, nodeId);
  const write = (cells: number[]) => api.setConfig(nodeId, { ...cfg(), cells });
  const p = canvasPanel('<span>stati</span><button data-a="-">−</button><button data-a="+">+</button>', 34, (a) => {
    const c = cfg().cells;
    if (a === '-' && c.length > 1) write(c.slice(0, -1));
    else if (a === '+' && c.length < 64) write([...c, 0]);
    else return;
    api.commit();
  });
  let paint = 0;
  let cells: number[] = [];
  const cellAt = (e: PointerEvent) => Math.floor(p.at(e).x * cells.length);
  onDrag(
    p.canvas,
    (e) => {
      cells = [...cfg().cells];
      const i = cellAt(e);
      paint = ((cells[i] ?? 0) + 1) % 3;
      cells[i] = paint;
      write([...cells]);
    },
    (e) => {
      const i = cellAt(e);
      if (cells[i] === paint) return;
      cells[i] = paint;
      write([...cells]);
    },
    () => api.commit(),
  );
  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      const c = cfg().cells;
      const cw = w / c.length;
      const ph = inputPhase(api, nodeId, 'phase', now);
      const cur = ph === null ? -1 : Math.floor(ph * c.length);
      c.forEach((st, i) => {
        const x = i * cw;
        g.fillStyle = i % 4 === 0 ? '#1c1c22' : '#15151a';
        g.fillRect(x + 1, 1, cw - 2, h - 2);
        if (st > 0) {
          g.fillStyle = st === 2 ? '#ffb347' : '#5ad1ff';
          const bh = st === 2 ? h - 4 : (h - 4) * 0.55;
          g.fillRect(x + 2, h - 2 - bh, cw - 4, bh);
        }
        if (i === cur) {
          g.strokeStyle = '#fff';
          g.strokeRect(x + 1.5, 1.5, cw - 3, h - 3);
        }
      });
    },
  };
}
