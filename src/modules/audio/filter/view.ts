/**
 * Filtro: la risposta in frequenza dell'SVF (20 Hz – 20 kHz, scala log) per
 * modo, cutoff e risonanza attuali, e sotto il segnale che esce.
 */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';

/** Guadagno del prototipo SVF alla frequenza x = f/fc. */
export function svfGain(mode: number, x: number, k: number): number {
  const d = Math.hypot(1 - x * x, k * x);
  if (mode === 0) return 1 / d;
  if (mode === 1) return x / d;
  if (mode === 2) return (x * x) / d;
  return Math.abs(1 - x * x) / d;
}

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const mode = Math.round(v.param('mode'));
    const fc = v.param('cutoff');
    const k = 2 - 1.98 * v.param('resonance');
    const lo = Math.log(20);
    const hi = Math.log(20000);
    const top = 3;
    const curveH = h - 14;
    const db = (gain: number) => Math.max(-36, Math.min(18, 20 * Math.log10(Math.max(1e-6, gain))));
    const y = (d: number) => top + ((18 - d) / 54) * curveH;
    g.strokeStyle = C.grid;
    g.beginPath();
    g.moveTo(0, y(0));
    g.lineTo(w, y(0));
    g.stroke();
    g.strokeStyle = C.audio;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const f = Math.exp(lo + ((hi - lo) * i) / 80);
      const py = y(db(svfGain(mode, f / fc, k)));
      if (i === 0) g.moveTo((i / 80) * w, py);
      else g.lineTo((i / 80) * w, py);
    }
    g.stroke();
    const cx = ((Math.log(fc) - lo) / (hi - lo)) * w;
    g.fillStyle = C.white;
    g.fillRect(cx - 0.5, top, 1, curveH);
    scope(g, v.scope('out'), 0, h - 12, w, 11, '#7a2a3a');
    label(g, fc >= 1000 ? `${(fc / 1000).toFixed(1)}k` : `${Math.round(fc)}`, Math.min(w - 2, cx + 3), 2, C.white, cx > w - 30 ? 'right' : 'left');
  },
});

export default view;
