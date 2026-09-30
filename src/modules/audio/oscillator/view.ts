/** Oscillatore: la forma d'onda dai parametri (un ciclo e mezzo) e, sopra, il segnale vero. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';

const NAMES = ['sine', 'triangolo', 'saw', 'quadra'];

function shape(wave: number, p: number, pw: number): number {
  switch (wave) {
    case 0:
      return Math.sin(2 * Math.PI * p);
    case 1:
      return 1 - 4 * Math.abs(p - 0.5);
    case 2:
      return 2 * p - 1;
    default:
      return p < pw ? 1 : -1;
  }
}

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const wave = Math.round(v.param('wave'));
    const pw = v.param('pw');
    g.strokeStyle = '#4a2a32';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 90; i++) {
      const p = (i / 90) * 1.5;
      const y = h / 2 - shape(wave, p - Math.floor(p), pw) * (h / 2 - 6);
      if (i === 0) g.moveTo((i / 90) * w, y);
      else g.lineTo((i / 90) * w, y);
    }
    g.stroke();
    const level = Math.max(0.05, v.param('level'));
    scope(g, v.scope('out'), 0, 3, w, h - 6, C.audio, 1 / level);
    label(g, NAMES[wave] ?? '', 3, 2);
  },
});

export default view;
