/** Curva dello swing per coppia di step, con la coppia che suona adesso. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';

export default function grooveSwingEditor(api: EditorApi, nodeId: string): Widget {
  const src = () => api.engine.patch.connections.find((c) => c.to === `${nodeId}.in`)?.from;
  return curveWidget(api, nodeId, {
    field: 'curve',
    title: 'swing per coppia di step (−1…1)',
    bipolar: true,
    resize: [1, 32],
    playhead: (now) => {
      const s = src();
      if (!s) return null;
      const x = api.live.value(s, now);
      return x - Math.floor(x);
    },
  });
}
