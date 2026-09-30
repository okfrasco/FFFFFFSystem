/**
 * Accoppiamento: le voci come punti su un cerchio, collegati al centro; quando
 * l'accoppiamento le attira i punti si raccolgono. La barra è la sincronia.
 */

import { C, clear, frac, label, meter, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const phases = v.voices('out');
    const sync = v.value('sync');
    const cx = h / 2;
    const cy = h / 2;
    const r = h / 2 - 7;
    g.strokeStyle = C.grid;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // media delle fasi: la direzione verso cui si raccolgono
    let re = 0;
    let im = 0;
    for (const p of phases) {
      const a = -Math.PI / 2 + frac(p) * Math.PI * 2;
      re += Math.cos(a);
      im += Math.sin(a);
      g.strokeStyle = '#2d4a55';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.stroke();
      g.fillStyle = C.phase;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    if (phases.length) {
      g.strokeStyle = C.value;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + (re / phases.length) * r, cy + (im / phases.length) * r);
      g.stroke();
    }
    meter(g, sync, w - 10, 6, 5, h - 12, C.value);
    label(g, `sync ${sync.toFixed(2)}`, h + 6, 8, C.white);
    label(g, `k ${v.param('coupling').toFixed(2)} · r ${v.param('tether').toFixed(2)}`, h + 6, 22);
  },
});

export default view;
