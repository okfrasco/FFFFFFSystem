/**
 * Sampler / Slicer: la forma d'onda con la zona (inizio–fine) e le fette.
 * Trascina sulla forma d'onda per scegliere la zona.
 */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { sampleWidget } from '../../../ui/editor/sampleWidget';

export default function samplerWidget(api: EditorApi, nodeId: string): Widget {
  const param = (id: string) => (api.engine.graph.has(nodeId) ? api.engine.graph.node(nodeId).params.value(id) : 0);
  let anchor = 0;
  return sampleWidget(api, nodeId, {
    height: 56,
    overlay(g, w, h) {
      const a = Math.min(param('start'), param('end'));
      const b = Math.max(param('start'), param('end'));
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, a * w, h);
      g.fillRect(b * w, 0, (1 - b) * w, h);
      g.fillStyle = '#5ad1ff';
      g.fillRect(a * w, 0, 1.5, h);
      g.fillRect(b * w - 1.5, 0, 1.5, h);
      if (param('mode') >= 0.5) {
        const n = Math.round(param('slices'));
        g.fillStyle = 'rgba(255,255,255,0.45)';
        for (let k = 1; k < n; k++) g.fillRect((a + ((b - a) * k) / n) * w, 0, 1, h);
        g.fillStyle = '#9a9aa6';
        g.font = '8px ui-monospace, Menlo, monospace';
        for (let k = 0; k < n && n <= 16; k++) g.fillText(String(k), (a + ((b - a) * k) / n) * w + 2, 9);
      }
    },
    onDrag(x, first) {
      if (first) anchor = x;
      api.setParam(nodeId, 'start', Math.min(anchor, x));
      api.setParam(nodeId, 'end', Math.max(anchor, x === anchor ? Math.min(1, x + 0.01) : x));
    },
    onRelease: () => api.commit(),
  });
}
