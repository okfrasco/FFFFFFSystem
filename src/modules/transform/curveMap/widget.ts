/** Editor della curva di Curve map, con la posizione dell'ingresso adesso. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';

export default function curveMapEditor(api: EditorApi, nodeId: string): Widget {
  const node = () => api.engine.graph.node(nodeId);
  const src = () => api.engine.patch.connections.find((c) => c.to === `${nodeId}.in`)?.from;
  return curveWidget(api, nodeId, {
    field: 'points',
    title: 'curva ingresso → uscita',
    resize: [2, 64],
    playhead: (now) => {
      const s = src();
      if (!s) return null;
      const lo = node().params.value('inLo');
      const hi = node().params.value('inHi');
      return Math.max(0, Math.min(1, (api.live.value(s, now) - lo) / Math.max(1e-6, hi - lo)));
    },
  });
}
