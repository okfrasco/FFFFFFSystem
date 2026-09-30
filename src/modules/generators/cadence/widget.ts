/**
 * Griglia della Cadenza: una cella per sedicesimo della size (righe da 16),
 * accese dove cade un colpo; la cella corrente è bordata mentre suona.
 */

import { cadenceHits } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';

export function cadenceWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  const grid = document.createElement('div');
  grid.className = 'gates';
  el.append(title, grid);
  const posTl = api.engine.tap(nodeId, 'pos', 64);
  let shown = '';
  let cells: HTMLElement[] = [];

  return {
    el,
    handles: () => false,
    update(now) {
      const p = api.engine.graph.node(nodeId).params;
      const m = p.getBase('multiple');
      const bl = p.getBase('barLength');
      const cad = p.getBase('cadence');
      const off = p.getBase('offset');
      const key = `${m}|${bl}|${cad}|${off}`;
      if (key !== shown) {
        shown = key;
        const { size, hits } = cadenceHits(m, bl, cad, off);
        title.textContent = `size ${size} sedicesimi · ${hits.length} colpi`;
        grid.innerHTML = '';
        cells = [];
        for (let i = 0; i < size; i++) {
          const c = document.createElement('div');
          c.className = `g${i > 0 && i % 4 === 0 ? ' q' : ''}`;
          c.style.height = '12px';
          c.style.width = '10px';
          c.style.cursor = 'default';
          if (hits.includes(i)) c.innerHTML = '<i style="height:100%"></i>';
          grid.append(c);
          cells.push(c);
        }
      }
      if (posTl.size) {
        const cur = Math.round(posTl.sample(now) * cells.length);
        cells.forEach((c, i) => (c.style.outline = i === cur ? '1px solid #fff' : ''));
      }
    },
  };
}

export default cadenceWidget;
