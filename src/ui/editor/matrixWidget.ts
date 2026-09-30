/**
 * Matrice di parametri dentro un nodo (FM, e chi ne ha bisogno): ogni cella
 * è un parametro, la luminosità è il suo valore effettivo (con le
 * modulazioni). Trascina in verticale per cambiarla (Shift = fine), doppio
 * clic per 0 ↔ 1; ogni cella accetta un cavo di modulazione. Le righe in più
 * (es. i livelli d'uscita) funzionano allo stesso modo.
 */

import type { EditorApi, Widget } from './api';
import { dragVertical } from './widgetKit';

export interface MatrixOptions {
  title: string;
  size: number;
  cellId: (row: number, col: number) => string;
  rowLabel: (row: number) => string;
  colLabel: (col: number) => string;
  extraRows?: { label: string; id: (col: number) => string }[];
  /** Tonalità del colore delle celle (gradi). */
  hue?: number;
}

export function matrixWidget(api: EditorApi, nodeId: string, o: MatrixOptions): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.textContent = o.title;
  const grid = document.createElement('div');
  grid.className = 'matrix';
  grid.style.gridTemplateColumns = `repeat(${o.size + 1}, 15px)`;
  el.append(title, grid);
  const node = () => api.engine.graph.node(nodeId);
  const lab = (text: string) => {
    const d = document.createElement('div');
    d.className = 'lab';
    d.textContent = text;
    grid.append(d);
  };
  const cells: { el: HTMLElement; id: string }[] = [];
  const cell = (id: string, tip: string) => {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.param = id;
    c.dataset.target = `${nodeId}.param:${id}`;
    c.title = tip;
    api.registerEndpoint(`${nodeId}.param:${id}`, c);
    let start = 0;
    dragVertical(
      c,
      () => (start = node().params.getBaseNormalized(id)),
      (dy, fine) => api.setParamNormalized(nodeId, id, start + dy / (fine ? 400 : 80)),
      () => api.commit(),
    );
    c.addEventListener('dblclick', () => {
      api.setParamNormalized(nodeId, id, node().params.getBaseNormalized(id) > 0 ? 0 : 1);
      api.commit();
    });
    grid.append(c);
    cells.push({ el: c, id });
  };
  lab('');
  for (let j = 0; j < o.size; j++) lab(o.colLabel(j));
  for (let i = 0; i < o.size; i++) {
    lab(o.rowLabel(i));
    for (let j = 0; j < o.size; j++) cell(o.cellId(i, j), `${o.colLabel(j)} → ${o.rowLabel(i)}`);
  }
  for (const r of o.extraRows ?? []) {
    lab(r.label);
    for (let j = 0; j < o.size; j++) cell(r.id(j), `${r.label} ${o.colLabel(j)}`);
  }
  const ids = new Set(cells.map((c) => c.id));
  const hue = o.hue ?? 80;
  return {
    el,
    handles: (id) => ids.has(id),
    update() {
      const p = node().params;
      for (const c of cells) {
        const w = p.normalized(c.id);
        c.el.style.background = w <= 0 ? '#16181c' : `hsl(${hue} ${40 + 60 * w}% ${12 + 50 * w}%)`;
        c.el.classList.toggle('modded', api.isModulated(nodeId, c.id));
      }
    },
  };
}
