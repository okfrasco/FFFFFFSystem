/** Editor della forma di Curve, con il punto di lettura attuale. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';

export default function curveEditor(api: EditorApi, nodeId: string): Widget {
  const node = () => api.engine.graph.node(nodeId);
  const phaseSource = () => api.engine.patch.connections.find((c) => c.to === `${nodeId}.phase`)?.from;
  return curveWidget(api, nodeId, {
    field: 'points',
    title: 'forma · disegna trascinando',
    resize: [2, 64],
    playhead: (now) => {
      const src = phaseSource();
      if (!src) return null;
      const u = api.live.value(src, now) * node().params.value('cycles') + node().params.value('offset');
      return u - Math.floor(u);
    },
  });
}
