/**
 * Disegno delle view dei nodi (canvas 2D): colori per tipo di segnale e
 * primitive (anello di fase, traccia, rullo di eventi, oscilloscopio, miniatura).
 * Tutte le coordinate sono in pixel CSS: il canvas è già scalato per il DPR.
 */

import type { ScopeFrame } from '../../core/audioAnalysis';
import type { LoggedEvent, ViewContext } from '../live';
import { PORT_COLORS } from './style';

export type { ViewContext, LoggedEvent };

export interface NodeViewDrawing {
  /** Altezza in pixel CSS (default 48). */
  height?: number;
  draw(g: CanvasRenderingContext2D, w: number, h: number, v: ViewContext): void;
}

/** Una view per nodo: export default di view.ts nella cartella del modulo. */
export type ViewFactory = (nodeId: string) => NodeViewDrawing;

export const C = {
  bg: '#0e0e11',
  grid: '#1f1f26',
  dim: '#555',
  text: '#9a9aa6',
  white: '#ffffff',
  phase: PORT_COLORS.phase!,
  value: PORT_COLORS.value!,
  gate: PORT_COLORS.gate!,
  event: PORT_COLORS.event!,
  audio: PORT_COLORS.audio!,
  texture: PORT_COLORS.texture!,
};

export function clear(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = C.bg;
  g.fillRect(0, 0, w, h);
}

export function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, color = C.text, align: CanvasTextAlign = 'left'): void {
  g.fillStyle = color;
  g.font = '9px ui-monospace, Menlo, monospace';
  g.textAlign = align;
  g.textBaseline = 'top';
  g.fillText(text, x, y);
}

/** Anello di fase: arco da 0 a frac(x). */
export function ring(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, color: string, width = 2): void {
  g.strokeStyle = C.grid;
  g.lineWidth = width;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = color;
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  g.stroke();
}

/** Traccia di valori (min/max automatici se non dati). */
export function sparkline(g: CanvasRenderingContext2D, values: number[], x: number, y: number, w: number, h: number, color: string, lo?: number, hi?: number): void {
  if (values.length < 2) return;
  let a = lo ?? Math.min(...values);
  let b = hi ?? Math.max(...values);
  if (b - a < 1e-6) {
    a -= 0.5;
    b += 0.5;
  }
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  values.forEach((v, i) => {
    const px = x + (i / (values.length - 1)) * w;
    const py = y + h - ((v - a) / (b - a)) * h;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.stroke();
}

/**
 * Rullo di eventi: gli ultimi `seconds` scorrono da destra (adesso) a
 * sinistra. Altezza del segno = velocity; posizione verticale = valore
 * (se `range`), altrimenti centrata.
 */
export function roll(
  g: CanvasRenderingContext2D,
  events: LoggedEvent[],
  now: number,
  seconds: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  range?: [number, number],
): void {
  for (const e of events) {
    const px = x + w - ((now - e.t) / seconds) * w;
    const age = (now - e.t) / seconds;
    g.globalAlpha = Math.max(0.15, 1 - age) * (0.4 + 0.6 * e.vel);
    g.fillStyle = color;
    if (range) {
      const [lo, hi] = range;
      const py = y + h - ((e.v - lo) / Math.max(1e-6, hi - lo)) * (h - 4) - 2;
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    } else {
      const bh = h * (0.3 + 0.7 * e.vel);
      g.fillRect(px - 1, y + (h - bh) / 2, 2, bh);
    }
  }
  g.globalAlpha = 1;
}

/** Oscilloscopio di un blocco audio. */
export function scope(g: CanvasRenderingContext2D, frame: ScopeFrame | null, x: number, y: number, w: number, h: number, color = C.audio, gain = 1): void {
  g.strokeStyle = C.grid;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y + h / 2);
  g.lineTo(x + w, y + h / 2);
  g.stroke();
  if (!frame) return;
  const s = frame.samples;
  g.strokeStyle = color;
  g.lineWidth = 1.25;
  g.beginPath();
  for (let i = 0; i < s.length; i++) {
    const px = x + (i / (s.length - 1)) * w;
    const py = y + h / 2 - Math.max(-1, Math.min(1, s[i]! * gain)) * (h / 2 - 1);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
}

/** Barra di livello verticale (0–1). */
export function meter(g: CanvasRenderingContext2D, level: number, x: number, y: number, w: number, h: number, color = C.value): void {
  g.fillStyle = C.grid;
  g.fillRect(x, y, w, h);
  const v = Math.max(0, Math.min(1, level));
  g.fillStyle = color;
  g.fillRect(x, y + h - v * h, w, v * h);
}

/** Miniatura di un visual, adattata al riquadro. */
const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function thumbnail(g: CanvasRenderingContext2D, img: ImageData | null, x: number, y: number, w: number, h: number): void {
  if (!img || !scratch) {
    label(g, 'nessuna immagine', x + w / 2, y + h / 2 - 4, C.dim, 'center');
    return;
  }
  if (scratch.width !== img.width || scratch.height !== img.height) {
    scratch.width = img.width;
    scratch.height = img.height;
  }
  scratch.getContext('2d')!.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(scratch, x, y, w, h);
}

export const frac = (x: number) => x - Math.floor(x);

export interface Lane {
  label: string;
  /** Eventi da disegnare come segni (colpi). */
  events?: LoggedEvent[];
  /** Storia di un livello o valore (0–1), da disegnare come traccia a gradini. */
  history?: number[];
  color: string;
}

/**
 * Corsie una sotto l'altra sullo stesso tempo (gli ultimi `seconds`, adesso a
 * destra): per vedere ingressi e uscite di un nodo logico insieme.
 */
export function lanes(g: CanvasRenderingContext2D, w: number, h: number, now: number, seconds: number, rows: Lane[]): void {
  const lh = h / Math.max(1, rows.length);
  rows.forEach((row, i) => {
    const y = i * lh;
    g.fillStyle = C.grid;
    g.fillRect(0, y + lh - 1, w, 1);
    label(g, row.label, 2, y + 1, C.dim);
    if (row.history && row.history.length > 1) {
      g.fillStyle = row.color;
      g.globalAlpha = 0.5;
      const n = row.history.length;
      for (let k = 0; k < n; k++) {
        const val = Math.max(0, Math.min(1, row.history[k]!));
        if (val <= 0) continue;
        const x0 = 14 + (k / n) * (w - 16);
        g.fillRect(x0, y + lh - 2 - val * (lh - 4), (w - 16) / n + 0.5, val * (lh - 4));
      }
      g.globalAlpha = 1;
    }
    if (row.events) roll(g, row.events, now, seconds, 14, y + 2, w - 16, lh - 4, row.color);
  });
}
