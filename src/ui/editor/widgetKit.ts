/** Aiuti per i widget dei moduli (editor dentro i nodi). */

import type { EditorApi } from './api';

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
