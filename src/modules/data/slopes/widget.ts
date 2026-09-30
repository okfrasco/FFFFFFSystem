/**
 * Editor di Slopes: trascina un punto per spostarlo, clic nel vuoto per
 * aggiungerne uno, doppio clic su un punto per toglierlo. Trascinando in
 * verticale a metà di un segmento se ne cambia la curvatura.
 */

import { readSlopes, type SlopePoint, type SlopesConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf, inputPhase, onDrag } from '../../../ui/editor/widgetKit';

const H = 72;

export default function slopesWidget(api: EditorApi, nodeId: string): Widget {
  const cfg = () => configOf<SlopesConfig>(api, nodeId);
  const write = (points: SlopePoint[]) => api.setConfig(nodeId, { ...cfg(), points: [...points].sort((a, b) => a[0] - b[0]) });
  const p = canvasPanel('<span>punti · doppio clic toglie · a metà segmento: curva</span>', H, () => {});
  let pts: SlopePoint[] = [];
  let drag: { kind: 'point'; i: number } | { kind: 'curve'; i: number; y0: number; c0: number } | null = null;
  const near = (x: number, y: number, w: number, h: number) => pts.findIndex(([px, py]) => Math.hypot((px - x) * w, (1 - py - y) * h) < 7);

  onDrag(
    p.canvas,
    (e) => {
      pts = cfg().points.map((q) => [...q] as SlopePoint);
      const { x, y } = p.at(e);
      const w = p.canvas.clientWidth;
      const i = near(x, y, w, H);
      if (i >= 0) {
        drag = { kind: 'point', i };
        return;
      }
      // vicino alla linea: curvatura del segmento; altrimenti un punto nuovo
      if (pts.length > 1 && Math.abs(1 - readSlopes(pts, x) - y) * H < 8) {
        let seg = pts.length - 1;
        pts.forEach(([px], k) => {
          if (px <= x) seg = k;
        });
        drag = { kind: 'curve', i: seg, y0: e.clientY, c0: pts[seg]![2] };
        return;
      }
      pts.push([x, 1 - y, 0]);
      pts.sort((a, b) => a[0] - b[0]);
      drag = { kind: 'point', i: pts.findIndex((q) => q[0] === x) };
      write(pts);
    },
    (e) => {
      if (!drag) return;
      const { x, y } = p.at(e);
      if (drag.kind === 'point') {
        const q = pts[drag.i]!;
        q[0] = +x.toFixed(4);
        q[1] = +(1 - y).toFixed(3);
      } else {
        const q = pts[drag.i]!;
        q[2] = +Math.max(-1, Math.min(1, drag.c0 + (e.clientY - drag.y0) / 40)).toFixed(2);
      }
      write(pts);
    },
    () => {
      drag = null;
      api.commit();
    },
  );
  p.canvas.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const { x, y } = p.at(e as PointerEvent);
    const cur = cfg().points.map((q) => [...q] as SlopePoint);
    pts = cur;
    const i = near(x, y, p.canvas.clientWidth, H);
    if (i < 0 || cur.length <= 1) return;
    cur.splice(i, 1);
    write(cur);
    api.commit();
  });

  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      const points = cfg().points;
      g.strokeStyle = '#5ad1ff';
      g.lineWidth = 1.5;
      g.beginPath();
      for (let px = 0; px <= w; px++) {
        const y = h - 2 - readSlopes(points, px / w) * (h - 4);
        if (px === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
      for (const [x, y, c] of points) {
        g.fillStyle = c === 0 ? '#fff' : '#ffb347';
        g.fillRect(x * w - 2.5, h - 2 - y * (h - 4) - 2.5, 5, 5);
      }
      const ph = inputPhase(api, nodeId, 'phase', now);
      if (ph !== null) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(ph * w - 0.5, 0, 1, h);
      }
    },
  };
}
