/** Granulare: il campione, la zona da cui partono i grani (posizione ± spray); trascina per spostare la posizione. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { sampleWidget } from '../../../ui/editor/sampleWidget';

export default function granularWidget(api: EditorApi, nodeId: string): Widget {
  const param = (id: string) => (api.engine.graph.has(nodeId) ? api.engine.graph.node(nodeId).params.value(id) : 0);
  return sampleWidget(api, nodeId, {
    overlay(g, w, h) {
      if (param('source') >= 0.5) return;
      const pos = param('position');
      const spray = param('spray');
      g.fillStyle = 'rgba(90,209,255,0.18)';
      g.fillRect(Math.max(0, pos - spray) * w, 0, (Math.min(1, pos + spray) - Math.max(0, pos - spray)) * w, h);
      g.fillStyle = '#5ad1ff';
      g.fillRect(pos * w - 1, 0, 2, h);
    },
    onDrag: (x) => api.setParam(nodeId, 'position', x),
    onRelease: () => api.commit(),
  });
}
