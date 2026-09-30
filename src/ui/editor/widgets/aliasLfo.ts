/** Striscia dei valori dell'LFO aliasato per step, come nel visualizzatore. */

import { aliasedLfo } from '../../../modules/generators/aliasLfo';
import type { EditorApi, Widget } from '../api';

export function aliasLfoWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  const bars = document.createElement('div');
  bars.className = 'bars';
  bars.style.height = '40px';
  bars.style.cursor = 'default';
  el.append(title, bars);
  let shown = '';
  return {
    el,
    handles: () => false,
    update() {
      const p = api.engine.graph.node(nodeId).params;
      const pattern = p.normalized('pattern') * 99; // con le modulazioni
      const len = p.getBase('length');
      const n = len > 0 ? Math.min(len, 64) : 32;
      const key = `${pattern.toFixed(2)}|${n}`;
      if (key === shown) return;
      shown = key;
      title.textContent = `pattern ${pattern.toFixed(1)} · ${n} step`;
      bars.innerHTML = '';
      for (let t = 0; t < n; t++) {
        const v = aliasedLfo(t, pattern);
        const b = document.createElement('div');
        b.className = 'b';
        b.innerHTML = `<i style="bottom:0;height:${Math.max(2, v * 100)}%;background:hsl(${190 + 120 * v} 80% 60%)"></i>`;
        bars.append(b);
      }
    },
  };
}
