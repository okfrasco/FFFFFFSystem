/**
 * Matrice di Markov nel nodo. Righe = stato di partenza, colonne = stato di
 * arrivo; la luminosità di una cella è il suo peso effettivo (con le
 * modulazioni). Sotto: il valore di ogni stato (v) e la sua attrazione (a).
 *
 * Trascina in verticale una cella per cambiarla, doppio clic per 0 ↔ 1,
 * Shift+trascina per dipingere a 1, Alt+trascina per dipingere a 0.
 * Ogni cella accetta un cavo di modulazione. La riga dello stato corrente è
 * evidenziata e l'ultima transizione lampeggia.
 */

import { MARKOV_MAX_STATES, attractionId, cellId, valueId } from '../../../modules/generators/markov';
import type { EditorApi, Widget } from '../api';
import { dragVertical } from './index';

const handled = /^(m\d+_\d+|v\d+|a\d+)$/;

export function markovWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  el.innerHTML = '<div class="wtitle">matrice · da (righe) → a (colonne)</div>';
  const grid = document.createElement('div');
  grid.className = 'matrix';
  el.append(grid);

  const stateTl = api.engine.tap(nodeId, 'state', 128);
  let built = 0;
  let cells: HTMLElement[][] = [];
  let vcells: HTMLElement[] = [];
  let acells: HTMLElement[] = [];
  let lastState = -1;
  let hitUntil = 0;
  let hitCell: HTMLElement | null = null;
  const node = () => api.engine.graph.node(nodeId);

  const paint = (e: PointerEvent) => {
    const value = e.shiftKey ? 1 : 0;
    e.stopPropagation();
    const apply = (x: number, y: number) => {
      const t = document.elementFromPoint(x, y) as HTMLElement | null;
      const id = t?.dataset.param;
      if (t && grid.contains(t) && id?.startsWith('m')) api.setParam(nodeId, id, value);
    };
    apply(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      api.commit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const build = (n: number) => {
    built = n;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${n + 1}, 15px)`;
    const lab = (text: string) => {
      const d = document.createElement('div');
      d.className = 'lab';
      d.textContent = text;
      grid.append(d);
    };
    lab('');
    for (let j = 0; j < n; j++) lab(String(j));
    cells = [];
    for (let i = 0; i < n; i++) {
      lab(String(i));
      const row: HTMLElement[] = [];
      for (let j = 0; j < n; j++) {
        const c = document.createElement('div');
        c.className = 'cell';
        const id = cellId(i, j);
        c.dataset.param = id;
        c.dataset.target = `${nodeId}.param:${id}`;
        c.title = `${i} → ${j}`;
        api.registerEndpoint(`${nodeId}.param:${id}`, c);
        let start = 0;
        dragVertical(
          c,
          () => (start = node().params.getBaseNormalized(id)),
          (dy, fine) => api.setParamNormalized(nodeId, id, start + dy / (fine ? 400 : 80)),
          () => api.commit(),
        );
        c.addEventListener('pointerdown', (e) => {
          if (e.shiftKey || e.altKey) paint(e);
        });
        c.addEventListener('dblclick', () => {
          api.setParam(nodeId, id, node().params.getBase(id) > 0 ? 0 : 1);
          api.commit();
        });
        grid.append(c);
        row.push(c);
      }
      cells.push(row);
    }
    lab('v');
    vcells = [];
    for (let j = 0; j < n; j++) {
      const c = document.createElement('div');
      c.className = 'vcell';
      const id = valueId(j);
      c.dataset.target = `${nodeId}.param:${id}`;
      c.title = `valore dello stato ${j} (trascina)`;
      api.registerEndpoint(`${nodeId}.param:${id}`, c);
      let start = 0;
      dragVertical(
        c,
        () => (start = node().params.getBase(id)),
        (dy) => api.setParam(nodeId, id, Math.round(start + dy / 8)),
        () => api.commit(),
      );
      grid.append(c);
      vcells.push(c);
    }
    lab('a');
    acells = [];
    for (let j = 0; j < n; j++) {
      const c = document.createElement('div');
      c.className = 'acell';
      c.innerHTML = '<i></i>';
      const id = attractionId(j);
      c.dataset.target = `${nodeId}.param:${id}`;
      c.title = `attrazione dello stato ${j} (trascina)`;
      api.registerEndpoint(`${nodeId}.param:${id}`, c);
      let start = 0;
      dragVertical(
        c,
        () => (start = node().params.getBaseNormalized(id)),
        (dy) => api.setParamNormalized(nodeId, id, start + dy / 80),
        () => api.commit(),
      );
      grid.append(c);
      acells.push(c);
    }
  };

  return {
    el,
    handles: (id) => handled.test(id),
    update(now) {
      const p = node().params;
      const n = Math.max(2, Math.min(MARKOV_MAX_STATES, p.getBase('size')));
      if (n !== built) build(n);
      const cur = Math.round(stateTl.sample(now) * (n - 1));
      if (cur !== lastState) {
        if (lastState >= 0 && lastState < n && cur < n) {
          hitCell?.classList.remove('hit');
          hitCell = cells[lastState]![cur]!;
          hitCell.classList.add('hit');
          hitUntil = now + 0.15;
        }
        lastState = cur;
      }
      if (hitCell && now > hitUntil) {
        hitCell.classList.remove('hit');
        hitCell = null;
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const id = cellId(i, j);
          const w = p.normalized(id);
          const c = cells[i]![j]!;
          c.style.background = w <= 0 ? '#16181c' : `hsl(80 ${40 + 60 * w}% ${12 + 50 * w}%)`;
          c.classList.toggle('cur', i === cur);
          c.classList.toggle('modded', api.isModulated(nodeId, id));
        }
        vcells[i]!.textContent = String(Math.round(p.value(valueId(i))));
        (acells[i]!.firstChild as HTMLElement).style.height = `${p.normalized(attractionId(i)) * 100}%`;
      }
    },
  };
}
