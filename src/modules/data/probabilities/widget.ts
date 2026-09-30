/** Probabilità per step, da disegnare, con lo step che si sta leggendo. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';
import { inputPhase } from '../../../ui/editor/widgetKit';

export default function probabilitiesWidget(api: EditorApi, nodeId: string): Widget {
  return curveWidget(api, nodeId, {
    field: 'probs',
    title: 'probabilità per step',
    resize: [1, 64],
    playhead: (now) => inputPhase(api, nodeId, 'phase', now),
    format: (v) => `${Math.round(v * 100)}%`,
  });
}
