/** Additivo: le ampiezze delle parziali da disegnare (una barra per parziale). */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { curveWidget } from '../../../ui/editor/curveWidget';
import { MAX_PARTIALS } from './index';

export default function additiveWidget(api: EditorApi, nodeId: string): Widget {
  return curveWidget(api, nodeId, { field: 'amps', title: 'ampiezza per parziale', resize: [1, MAX_PARTIALS], format: (v) => v.toFixed(2) });
}
