/**
 * Cicli: un anello per corsia (dall'esterno), con le sue tacche e la
 * posizione attuale; un lampo quando colpisce, un lampo pieno quando si
 * riallineano tutte.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { realign } from './index';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const lanes = Math.round(v.param('lanes'));
    const div = Math.round(v.param('division'));
    const step = Math.floor(v.input.value('phase') * div);
    const aligned = v.events('align', 0.2).length > 0;
    const hits = v.events('trig', 0.12);
    const cx = h / 2;
    const cy = h / 2;
    const lens: number[] = [];
    for (let i = 0; i < lanes; i++) {
      const L = Math.max(1, Math.round(v.param(`len${i + 1}`)));
      lens.push(L);
      const r = h / 2 - 4 - i * ((h / 2 - 8) / lanes);
      const pos = ((step % L) + L) % L;
      const lit = hits.some((e) => e.voice === i);
      g.strokeStyle = aligned ? C.white : lit ? C.event : '#2c2c34';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      const a = -Math.PI / 2 + (pos / L) * Math.PI * 2;
      g.fillStyle = pos === 0 ? C.white : C.event;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    label(g, lens.join(' · '), h + 6, 8, C.white);
    label(g, `riallineo ogni ${realign(lens)} step`, h + 6, 22);
  },
});

export default view;
