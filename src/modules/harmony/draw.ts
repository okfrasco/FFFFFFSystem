/** Disegno comune delle view di armonia: tastiera e cerchio delle 12 classi. */

import { C, label } from '../../ui/editor/viewKit';
import { NOTE_NAMES, pc } from './theory';

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * Tastiera orizzontale da `lo` a `hi` (MIDI). `inScale` schiarisce i tasti
 * della scala; `color` colora le note suonate (null = spenta).
 */
export function keys(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lo: number,
  hi: number,
  inScale: (pc: number) => boolean,
  color: (note: number) => string | null,
): void {
  const n = hi - lo + 1;
  const kw = w / n;
  for (let k = 0; k < n; k++) {
    const note = lo + k;
    const p = pc(note);
    const black = BLACK.has(p);
    g.fillStyle = inScale(p) ? (black ? '#2c3440' : '#3a4656') : black ? '#101014' : '#1b1b21';
    g.fillRect(x + k * kw, y, Math.max(1, kw - 1), h);
    const c = color(note);
    if (c) {
      g.fillStyle = c;
      g.fillRect(x + k * kw, y + h * 0.35, Math.max(1, kw - 1), h * 0.65);
    }
    if (p === 0 && kw * 3 > 14) label(g, `C${Math.floor(note / 12) - 2}`, x + k * kw + 1, y + 1, C.dim);
  }
}

/**
 * Cerchio delle 12 classi in ordine di quinte (C in alto, G a destra).
 * `fill` dà il colore di ogni classe (null = vuota), `ring` quelle della scala.
 */
export function fifthsCircle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  inScale: (pc: number) => boolean,
  fill: (pc: number) => string | null,
  names = true,
): void {
  for (let i = 0; i < 12; i++) {
    const p = pc(i * 7);
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const rr = Math.max(2.5, r * 0.2);
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fillStyle = fill(p) ?? (inScale(p) ? '#2c3440' : '#141418');
    g.fill();
    if (inScale(p)) {
      g.strokeStyle = '#5a6a80';
      g.lineWidth = 1;
      g.stroke();
    }
    if (names && rr >= 6) {
      g.font = '8px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = fill(p) ? '#000' : C.text;
      g.fillText(NOTE_NAMES[p]!, px, py);
    }
  }
}

/** Le note di un accordo come stringa ("C E G"). */
export const chordLabel = (notes: readonly number[]): string => notes.map((p) => NOTE_NAMES[pc(p)]).join(' ');
