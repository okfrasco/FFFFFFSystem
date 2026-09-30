/**
 * Karplus-Strong: una corda tesa che vibra con il segnale vero (il blocco
 * audio steso lungo la corda, fisso ai due capi), e le ultime note pizzicate.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const frame = v.scope('out');
    const level = Math.max(0.05, v.param('level'));
    const mid = h / 2 + 3;
    // i due capi fissi
    g.fillStyle = C.dim;
    g.fillRect(4, mid - 8, 2, 16);
    g.fillRect(w - 6, mid - 8, 2, 16);
    g.strokeStyle = C.audio;
    g.lineWidth = 1.5;
    g.beginPath();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const s = frame ? frame.samples[Math.floor(u * (frame.samples.length - 1))]! / level : 0;
      // inviluppo a seno: la corda è ferma ai capi
      const y = mid - Math.max(-1, Math.min(1, s)) * Math.sin(Math.PI * u) * (h / 2 - 6);
      const x = 5 + u * (w - 10);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    const last = v.input.events('note', 2).at(-1);
    if (last) {
      const p = Math.round(last.v);
      label(g, `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`, 8, 1, C.event);
    }
    label(g, `T60 ${v.param('decay').toFixed(1)} s`, w - 8, 1, C.text, 'right');
  },
});

export default view;
