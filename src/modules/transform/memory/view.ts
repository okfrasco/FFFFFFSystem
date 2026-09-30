/**
 * Memoria: il giro del loop come un cerchio; ogni evento ricordato è un
 * punto (distanza dal centro = valore), la lancetta è la posizione nel loop.
 * In ascolto mostra ciò che sta registrando, in ripeti ciò che sta derivando.
 */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';

interface MemItem {
  pos: number;
  vel: number;
  value?: number;
  pitch?: number;
  orig: number | null;
}
interface MemState {
  holding: boolean;
  length: number;
  items: MemItem[];
  recent: { abs: number; ev: { vel: number; value?: number; pitch?: number } }[];
}

const view: ViewFactory = () => ({
  height: 72,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<MemState>();
    if (!st) return;
    const phase = v.input.value('phase');
    const L = st.holding ? st.length : Math.max(1, Math.round(v.param('length')));
    const pts: { pos: number; val: number; vel: number; mutated: boolean }[] = st.holding
      ? st.items.map((it) => ({ pos: it.pos / L, val: it.value ?? it.pitch ?? 0, vel: it.vel, mutated: it.orig === null }))
      : st.recent
          .filter((r) => r.abs > phase - L)
          .map((r) => ({ pos: frac(r.abs / L), val: r.ev.value ?? r.ev.pitch ?? 0, vel: r.ev.vel, mutated: false }));
    const vals = pts.map((p) => p.val);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(1, ...vals);
    const cx = h / 2;
    const cy = h / 2;
    const R = h / 2 - 5;
    g.strokeStyle = C.grid;
    for (const rr of [R * 0.35, R]) {
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of pts) {
      const a = -Math.PI / 2 + p.pos * Math.PI * 2;
      const rr = R * (0.35 + 0.65 * ((p.val - lo) / (hi - lo)));
      g.globalAlpha = 0.4 + 0.6 * p.vel;
      g.fillStyle = p.mutated ? C.white : st.holding ? C.event : C.dim;
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    const a = -Math.PI / 2 + frac(phase / L) * Math.PI * 2;
    g.strokeStyle = st.holding ? C.event : C.phase;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
    label(g, st.holding ? 'ripeti' : 'ascolta', h + 6, 8, st.holding ? C.event : C.white);
    label(g, `${pts.length} eventi · ${L} cicli`, h + 6, 22);
    if (st.holding) label(g, `${pts.filter((p) => p.mutated).length} nati da mutazione`, h + 6, 36);
  },
});

export default view;
