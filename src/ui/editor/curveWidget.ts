/**
 * Editor di curve dentro un nodo: una fila di punti (0–1, oppure −1…1 se
 * bipolare) salvati nella config del modulo, da disegnare trascinando.
 * `playhead` (se c'è) mostra dove si legge la curva adesso.
 * Lo usano Curve, Curve map, Swing continuo, Groove template.
 */

import type { EditorApi, Widget } from './api';
import { configOf } from './widgetKit';

export interface CurveWidgetOptions {
  /** Campo della config con l'array dei punti. */
  field: string;
  title: string;
  bipolar?: boolean;
  /** Numero di punti modificabile con − / + (tra min e max). */
  resize?: [number, number];
  /** Posizione di lettura attuale (0–1), o null. */
  playhead?: (now: number) => number | null;
  /** Etichetta del valore di un punto (per il suggerimento). */
  format?: (v: number) => string;
}

export function curveWidget(api: EditorApi, nodeId: string, o: CurveWidgetOptions): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.innerHTML = `<span></span>${o.resize ? '<button data-a="-">−</button><button data-a="+">+</button>' : ''}`;
  (title.firstChild as HTMLElement).textContent = o.title;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:56px;display:block;background:#0e0e11;border:1px solid #25252c;cursor:crosshair;touch-action:none';
  el.append(title, canvas);

  const cfg = () => configOf<Record<string, unknown>>(api, nodeId);
  const points = (): number[] => (cfg()[o.field] as number[] | undefined) ?? [];
  const lo = o.bipolar ? -1 : 0;
  const write = (pts: number[]) => api.setConfig(nodeId, { ...cfg(), [o.field]: pts });

  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (!a || !o.resize) return;
    const p = points();
    if (a === '-' && p.length > o.resize[0]) write(p.slice(0, -1));
    else if (a === '+' && p.length < o.resize[1]) write([...p, p.at(-1) ?? 0]);
    else return;
    api.commit();
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    canvas.setPointerCapture(e.pointerId);
    const pts = [...points()];
    let last = -1;
    const set = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const i = Math.max(0, Math.min(pts.length - 1, Math.floor(((ev.clientX - r.left) / r.width) * pts.length)));
      const v = lo + (1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))) * (1 - lo);
      const from = last < 0 ? i : last;
      for (let k = Math.min(from, i); k <= Math.max(from, i); k++) pts[k] = +v.toFixed(3);
      last = i;
      write([...pts]);
    };
    set(e);
    const up = () => {
      canvas.removeEventListener('pointermove', set);
      canvas.removeEventListener('pointerup', up);
      api.commit();
    };
    canvas.addEventListener('pointermove', set);
    canvas.addEventListener('pointerup', up);
  });

  return {
    el,
    handles: () => false,
    update(now) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w) return;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const pts = points();
      const n = Math.max(1, pts.length);
      const cw = w / n;
      const Y = (v: number) => h - ((v - lo) / (1 - lo)) * h;
      if (o.bipolar) {
        g.fillStyle = '#26262e';
        g.fillRect(0, Y(0), w, 1);
      }
      pts.forEach((v, i) => {
        g.fillStyle = '#5ad1ff';
        const y0 = o.bipolar ? Y(0) : h;
        const y1 = Y(v);
        g.fillRect(i * cw + 1, Math.min(y0, y1), Math.max(1, cw - 2), Math.max(1.5, Math.abs(y1 - y0)));
      });
      const ph = o.playhead?.(now);
      if (ph !== null && ph !== undefined) {
        g.fillStyle = '#fff';
        g.fillRect(ph * w - 0.5, 0, 1.5, h);
      }
      const hover = canvas.matches(':hover');
      canvas.title = hover && o.format ? pts.map(o.format).join(' ') : '';
    },
  };
}
