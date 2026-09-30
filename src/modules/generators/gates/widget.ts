/**
 * Tabella di Gates: clic per accendere/spegnere uno step, trascina in
 * verticale per la velocity (accento). −/+ cambiano la lunghezza.
 */

import type { GatesConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { configOf } from '../../../ui/editor/widgetKit';

export function gatesWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.innerHTML = '<span>step</span><button data-a="-">−</button><button data-a="+">+</button>';
  const row = document.createElement('div');
  row.className = 'gates';
  el.append(title, row);

  const cfg = () => configOf<GatesConfig>(api, nodeId);
  let shown = '';
  const write = (gates: number[]) => api.setConfig(nodeId, { ...cfg(), gates });

  const render = () => {
    const c = cfg();
    row.innerHTML = '';
    c.gates.forEach((g, idx) => {
      const cell = document.createElement('div');
      cell.className = `g${idx > 0 && idx % 4 === 0 ? ' q' : ''}`;
      cell.title = g > 0 ? `velocity ${g.toFixed(2)}` : 'pausa';
      cell.innerHTML = `<i style="height:${g * 100}%"></i>`;
      cell.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        cell.setPointerCapture(e.pointerId);
        const y0 = e.clientY;
        const start = cfg().gates[idx] ?? 0;
        let moved = false;
        const move = (ev: PointerEvent) => {
          if (Math.abs(ev.clientY - y0) < 3 && !moved) return;
          moved = true;
          const gates = [...cfg().gates];
          gates[idx] = +Math.max(0, Math.min(1, (start || 0.5) + (y0 - ev.clientY) / 60)).toFixed(2);
          write(gates);
        };
        const up = () => {
          cell.removeEventListener('pointermove', move);
          cell.removeEventListener('pointerup', up);
          if (!moved) {
            const gates = [...cfg().gates];
            gates[idx] = gates[idx]! > 0 ? 0 : 1;
            write(gates);
          }
          api.commit();
        };
        cell.addEventListener('pointermove', move);
        cell.addEventListener('pointerup', up);
      });
      row.append(cell);
    });
    shown = JSON.stringify(c);
  };

  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    const g = cfg().gates;
    if (a === '-' && g.length > 1) write(g.slice(0, -1));
    else if (a === '+' && g.length < 64) write([...g, 0]);
    else return;
    api.commit();
  });

  render();
  return {
    el,
    handles: () => false,
    update() {
      if (JSON.stringify(cfg()) !== shown) render();
    },
  };
}

export default gatesWidget;
