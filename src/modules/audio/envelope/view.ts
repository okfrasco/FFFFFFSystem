/** Inviluppo: il profilo ADSR dai parametri e il livello che esce adesso. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const a = 0.05 + 0.25 * v.normalized('attack');
    const d = 0.05 + 0.25 * v.normalized('decay');
    const r = 0.05 + 0.25 * v.normalized('release');
    const sus = v.param('sustain');
    const hold = 1 - a - d - r;
    const top = 4;
    const base = h - 4;
    const y = (lv: number) => base - lv * (base - top);
    const xs = [0, a, a + d, a + d + hold, 1].map((f) => f * w);
    g.strokeStyle = C.audio;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(xs[0]!, y(0));
    g.lineTo(xs[1]!, y(1));
    // decadimento e rilascio esponenziali
    for (let i = 1; i <= 20; i++) g.lineTo(xs[1]! + ((xs[2]! - xs[1]!) * i) / 20, y(sus + (1 - sus) * Math.exp((-6.9 * i) / 20)));
    g.lineTo(xs[3]!, y(sus));
    for (let i = 1; i <= 20; i++) g.lineTo(xs[3]! + ((xs[4]! - xs[3]!) * i) / 20, y(sus * Math.exp((-6.9 * i) / 20)));
    g.stroke();
    // livello attuale (somma delle voci: si mostra il massimo del blocco)
    const frame = v.scope('out');
    let level = 0;
    if (frame) for (const s of frame.samples) level = Math.max(level, s);
    g.fillStyle = C.white;
    g.fillRect(0, y(Math.min(1, level)) - 1, w, 1.5);
    label(g, level.toFixed(2), w - 2, 2, C.white, 'right');
  },
});

export default view;
