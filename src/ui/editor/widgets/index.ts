/** Widget dedicati per modulo (editor dentro il nodo). */

import type { EditorApi, Widget } from '../api';
import { aliasLfoWidget } from './aliasLfo';
import { cadenceWidget } from './cadence';
import { gatesWidget } from './gates';
import { lsystemWidget } from './lsystem';
import { markovWidget } from './markov';
import { stepsWidget } from './steps';

export function widgetFor(api: EditorApi, nodeId: string, moduleId: string): Widget | null {
  switch (moduleId) {
    case 'markov':
      return markovWidget(api, nodeId);
    case 'steps':
      return stepsWidget(api, nodeId);
    case 'gates':
      return gatesWidget(api, nodeId);
    case 'lsystem':
      return lsystemWidget(api, nodeId);
    case 'cadence':
      return cadenceWidget(api, nodeId);
    case 'aliasLfo':
      return aliasLfoWidget(api, nodeId);
    default:
      return null;
  }
}

/** Config in uso di un nodo (quella della patch, o il default del modulo). */
export function configOf<T>(api: EditorApi, nodeId: string): T {
  const pn = api.engine.patch.nodes.find((n) => n.id === nodeId);
  return (pn?.config ?? api.engine.graph.node(nodeId).def.defaultConfig) as T;
}

/**
 * Trascinamento verticale su un elemento: `onDelta` riceve lo spostamento in
 * pixel verso l'alto dall'inizio del gesto; al rilascio `commit`.
 */
export function dragVertical(
  el: HTMLElement,
  onStart: () => void,
  onDelta: (dyUp: number, fine: boolean) => void,
  commit: () => void,
): void {
  el.addEventListener('pointerdown', (e) => {
    if (e.shiftKey || e.altKey) return; // lasciati alla pittura
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    onStart();
    const move = (ev: PointerEvent) => onDelta(y0 - ev.clientY, ev.shiftKey);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      commit();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}
