/**
 * Griglia di Tabella 2D: trascina per dipingere con il pennello del titolo
 * (clic: 0, ¼, ½, ¾, 1); Alt/Option dipinge 0. I pulsanti ↔ e ↕ cambiano
 * colonne e righe. La cella letta adesso è bordata di bianco.
 */

import { readTable, type Table2dConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf, inputPhase, onDrag } from '../../../ui/editor/widgetKit';

const BRUSHES = [0, 0.25, 0.5, 0.75, 1];

/** Ridimensiona la matrice tenendo le celle che restano dentro. */
export function resize(c: Table2dConfig, w: number, h: number): Table2dConfig {
  const cells: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push(x < c.w && y < c.h ? (c.cells[y * c.w + x] ?? 0) : 0);
  return { w, h, cells };
}

export default function table2dWidget(api: EditorApi, nodeId: string): Widget {
  const cfg = () => configOf<Table2dConfig>(api, nodeId);
  let brush = 1;
  const brushLabel = (b: number) => (b === 0.25 ? '¼' : b === 0.5 ? '½' : b === 0.75 ? '¾' : String(b));
  const p = canvasPanel(
    '<span>pennello</span><button data-a="brush" title="valore dipinto (clic: il prossimo)">1</button><button data-a="w-">↔−</button><button data-a="w+">+</button><button data-a="h-">↕−</button><button data-a="h+">+</button>',
    72,
    (a, e) => {
      if (a === 'brush') {
        brush = BRUSHES[(BRUSHES.indexOf(brush) + 1) % BRUSHES.length]!;
        (e.target as HTMLElement).textContent = brushLabel(brush);
        return;
      }
      const c = cfg();
      const w = c.w + (a === 'w+' ? 1 : a === 'w-' ? -1 : 0);
      const h = c.h + (a === 'h+' ? 1 : a === 'h-' ? -1 : 0);
      if (w < 1 || h < 1 || w > 32 || h > 32) return;
      api.setConfig(nodeId, resize(c, w, h));
      api.commit();
    },
  );
  let cells: number[] = [];
  let value = 1;
  const paint = (e: PointerEvent) => {
    const c = cfg();
    const { x, y } = p.at(e);
    const i = Math.floor(y * c.h) * c.w + Math.floor(x * c.w);
    if (cells[i] === value) return;
    cells[i] = value;
    api.setConfig(nodeId, { ...c, cells: [...cells] });
  };
  onDrag(
    p.canvas,
    (e) => {
      cells = [...cfg().cells];
      value = e.altKey ? 0 : brush;
      paint(e);
    },
    paint,
    () => api.commit(),
  );
  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      const c = cfg();
      const cw = w / c.w;
      const ch = h / c.h;
      for (let y = 0; y < c.h; y++) {
        for (let x = 0; x < c.w; x++) {
          const v = readTable(c, (x + 0.5) / c.w, (y + 0.5) / c.h, 0);
          g.fillStyle = `rgba(90,209,255,${0.08 + v * 0.92})`;
          g.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
        }
      }
      const px = inputPhase(api, nodeId, 'x', now);
      if (px === null) return;
      const py = inputPhase(api, nodeId, 'y', now) ?? 0;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.strokeRect(Math.floor(px * c.w) * cw + 1, Math.floor(py * c.h) * ch + 1, cw - 2, ch - 2);
      g.fillStyle = '#fff';
      g.fillRect(px * w - 2, py * h - 2, 4, 4);
    },
  };
}
