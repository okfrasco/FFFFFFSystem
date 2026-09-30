/** Disegno comune delle view dei filtri: una curva di risposta su scala logaritmica (20 Hz – 20 kHz). */

import { C } from '../../ui/editor/viewKit';

export function responseCurve(g: CanvasRenderingContext2D, w: number, h: number, gain: (f: number) => number, color = C.audio): void {
  const top = 4;
  const H = h - 8;
  // 0 dB a metà altezza, ±24 dB ai bordi
  const Y = (a: number) => top + H / 2 - (Math.max(-24, Math.min(24, 20 * Math.log10(Math.max(1e-6, a)))) / 24) * (H / 2);
  g.fillStyle = '#1f1f26';
  g.fillRect(0, Y(1), w, 1);
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const f = 20 * Math.pow(1000, x / w);
    const y = Y(gain(f));
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}
