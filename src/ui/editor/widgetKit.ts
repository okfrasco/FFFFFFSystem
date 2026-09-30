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

/** Valore attuale della sorgente collegata a un ingresso del nodo (null se scollegato). */
export function inputValue(api: EditorApi, nodeId: string, port: string, now: number): number | null {
  const src = api.engine.patch.connections.find((c) => c.to === `${nodeId}.${port}`)?.from;
  return src ? api.live.value(src, now) : null;
}

/** Posizione nel ciclo (0–1) della fase collegata a un ingresso, o null. */
export function inputPhase(api: EditorApi, nodeId: string, port: string, now: number): number | null {
  const x = inputValue(api, nodeId, port, now);
  return x === null ? null : x - Math.floor(x);
}

export interface CanvasPanel {
  el: HTMLDivElement;
  title: HTMLDivElement;
  canvas: HTMLCanvasElement;
  /** Contesto già scalato per il DPR, con le misure in pixel CSS (null se nascosto). */
  begin(): { g: CanvasRenderingContext2D; w: number; h: number } | null;
  /** Punto del puntatore in coordinate 0–1 del canvas. */
  at(e: PointerEvent): { x: number; y: number };
}

/**
 * Pannello di widget con un titolo (testo e pulsanti `data-a`) e un canvas da
 * disegnare: i clic sui pulsanti arrivano a `onButton`.
 */
export function canvasPanel(titleHtml: string, height: number, onButton: (action: string, e: MouseEvent) => void): CanvasPanel {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.innerHTML = titleHtml;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width:100%;height:${height}px;display:block;background:#0e0e11;border:1px solid #25252c;cursor:crosshair;touch-action:none`;
  el.append(title, canvas);
  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a) onButton(a, e);
  });
  return {
    el,
    title,
    canvas,
    begin() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return null;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const g = canvas.getContext('2d');
      if (!g) return null;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      return { g, w, h };
    },
    at(e) {
      const r = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(0.9999, (e.clientY - r.top) / r.height)) };
    },
  };
}

/** Gesto di trascinamento sul canvas: `move` riceve anche il primo punto. */
export function onDrag(canvas: HTMLCanvasElement, start: (e: PointerEvent) => void, move: (e: PointerEvent) => void, end: () => void): void {
  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    canvas.setPointerCapture(e.pointerId);
    start(e);
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      end();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
  });
}
