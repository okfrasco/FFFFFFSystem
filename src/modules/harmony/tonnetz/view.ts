/**
 * Tonnetz: il reticolo (quinte in orizzontale, terze maggiori in diagonale)
 * con la triade attuale come triangolo pieno e le ultime come tracce.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { NOTE_NAMES, fifthsPos, pc, type Triad } from '../theory';

const J0 = -1;
const J1 = 1;

const view: ViewFactory = () => ({
  height: 84,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ triad: Triad; path: Triad[] }>();
    // la finestra segue la triade attuale: la sua fondamentale sta al centro (quinte = 7·i, 7·7 ≡ 1)
    const ic = st ? fifthsPos(st.triad.root) : 0;
    const I0 = ic - 3;
    const I1 = ic + 3;
    const step = Math.min((w - 12) / (I1 - I0 + (J1 - J0) * 0.5), (h - 16) / ((J1 - J0) * 0.866));
    const ox = 6 - (I0 + J0 * 0.5) * step;
    const oy = h - 6 + J0 * 0.866 * step;
    const P = (i: number, j: number) => [ox + (i + j * 0.5) * step, oy - j * 0.866 * step] as const;
    const cx = w / 2;
    const cy = h / 2;
    // il triangolo di una triade più vicino al centro
    const tri = (t: Triad) => {
      let best: (readonly [number, number])[] | null = null;
      let bd = Infinity;
      for (let i = I0; i < I1; i++) {
        for (let j = J0; j <= J1; j++) {
          if (pc(7 * i + 4 * j) !== t.root) continue;
          const pts = t.minor ? [P(i, j), P(i + 1, j), P(i + 1, j - 1)] : [P(i, j), P(i + 1, j), P(i, j + 1)];
          if (t.minor ? j - 1 < J0 : j + 1 > J1) continue;
          const mx = (pts[0]![0] + pts[1]![0] + pts[2]![0]) / 3;
          const my = (pts[0]![1] + pts[1]![1] + pts[2]![1]) / 3;
          const d = Math.hypot(mx - cx, my - cy);
          if (d < bd) {
            bd = d;
            best = pts;
          }
        }
      }
      return best;
    };
    const fillTri = (t: Triad, color: string) => {
      const pts = tri(t);
      if (!pts) return;
      g.beginPath();
      g.moveTo(pts[0]![0], pts[0]![1]);
      g.lineTo(pts[1]![0], pts[1]![1]);
      g.lineTo(pts[2]![0], pts[2]![1]);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    const path = st?.path ?? [];
    path.slice(0, -1).forEach((t, k) => fillTri(t, `rgba(90,209,255,${0.06 + (k / path.length) * 0.25})`));
    if (st) fillTri(st.triad, 'rgba(90,209,255,0.75)');
    const cur = st ? new Set([st.triad.root, pc(st.triad.root + (st.triad.minor ? 3 : 4)), pc(st.triad.root + 7)]) : new Set<number>();
    g.font = '8px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = I0; i <= I1; i++) {
      for (let j = J0; j <= J1; j++) {
        const [x, y] = P(i, j);
        if (x < 2 || x > w - 2) continue;
        const p = pc(7 * i + 4 * j);
        g.fillStyle = cur.has(p) ? C.white : '#666';
        g.fillText(NOTE_NAMES[p]!, x, y);
      }
    }
    if (st) label(g, `${NOTE_NAMES[st.triad.root]}${st.triad.minor ? 'm' : ''}`, 3, 0, C.white);
    const last = v.events('change', 0.4).at(-1);
    if (last && last.v >= 0) label(g, 'PLR'[last.v] ?? '', w - 3, 0, C.event, 'right');
  },
});

export default view;
