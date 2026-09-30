/** Groove template: la tabella degli offset (−1…1 step) e quella delle velocity, da disegnare. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';

export default function grooveTemplateEditor(api: EditorApi, nodeId: string): Widget {
  const src = () => api.engine.patch.connections.find((c) => c.to === `${nodeId}.phase`)?.from;
  const playhead = (now: number) => {
    const s = src();
    if (!s) return null;
    const x = api.live.value(s, now);
    return x - Math.floor(x);
  };
  const offsets = curveWidget(api, nodeId, { field: 'offsets', title: 'micro-offset per step (±1 step)', bipolar: true, resize: [1, 32], playhead, format: (v) => v.toFixed(2) });
  const velocity = curveWidget(api, nodeId, { field: 'velocity', title: 'velocity per step', resize: [1, 32], playhead });
  const el = document.createElement('div');
  el.append(offsets.el, velocity.el);
  return {
    el,
    handles: () => false,
    update(now) {
      offsets.update(now);
      velocity.update(now);
    },
  };
}
