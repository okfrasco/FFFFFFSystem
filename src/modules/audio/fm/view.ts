/**
 * FM: l'algoritmo come grafo. Quattro operatori in fila; un arco da j a i è
 * spesso quanto la modulazione m{i}_{j}; l'anello sopra un operatore è il suo
 * feedback; la freccia in basso è il suo livello d'uscita. Sotto, il segnale.
 */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { OPS, mId } from './index';

const view: ViewFactory = () => ({
  height: 78,
  draw(g, w, h, v) {
    clear(g, w, h);
    const y = 34;
    const X = (k: number) => w * ((k + 0.5) / OPS);
    const r = 8;
    for (let i = 0; i < OPS; i++) {
      for (let j = 0; j < OPS; j++) {
        const a = v.param(mId(i, j));
        if (a <= 0.001) continue;
        g.strokeStyle = `rgba(255,120,150,${0.35 + 0.65 * a})`;
        g.lineWidth = 0.5 + a * 4;
        g.beginPath();
        if (i === j) g.arc(X(i), y - r - 5, 5, 0, Math.PI * 2);
        else {
          // archi sopra da sinistra a destra, sotto da destra a sinistra
          const up = j < i;
          const mx = (X(i) + X(j)) / 2;
          const bend = (up ? -1 : 1) * (10 + Math.abs(i - j) * 6);
          g.moveTo(X(j), y + (up ? -r : r));
          g.quadraticCurveTo(mx, y + bend, X(i), y + (up ? -r : r));
        }
        g.stroke();
      }
    }
    for (let k = 0; k < OPS; k++) {
      const o = v.param(`o${k + 1}`);
      if (o > 0.001) {
        g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * o})`;
        g.fillRect(X(k) - 1, y + r + 2, 2, 8 + o * 8);
      }
      g.beginPath();
      g.arc(X(k), y, r, 0, Math.PI * 2);
      g.fillStyle = o > 0.001 ? '#3a2330' : '#1b1b21';
      g.fill();
      g.strokeStyle = C.audio;
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = C.white;
      g.font = '9px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(k + 1), X(k), y);
      label(g, `×${v.param(`r${k + 1}`).toFixed(2)}`, X(k), 1, C.dim, 'center');
    }
    scope(g, v.scope('out'), 0, h - 18, w, 17, C.audio, 1 / Math.max(0.05, v.param('level')));
  },
});

export default view;
