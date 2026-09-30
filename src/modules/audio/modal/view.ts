/**
 * Modale: i modi del materiale sulla scala delle frequenze (rapporto con la
 * fondamentale), alti quanto la loro ampiezza e con la coda lunga quanto il
 * loro decadimento; sotto il segnale.
 */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { MATERIALS, modesOf } from './index';

const view: ViewFactory = () => ({
  height: 60,
  draw(g, w, h, v) {
    clear(g, w, h);
    const modes = modesOf(60, Math.round(v.param('material')), Math.round(v.param('modes')), v.param('decay'), v.param('damping'), v.param('brightness'), v.param('position'), v.param('inharm'), 1e9);
    const f0 = modes[0]?.f ?? 1;
    const maxR = Math.log2((modes.at(-1)?.f ?? f0 * 2) / f0) + 0.5;
    const maxA = Math.max(...modes.map((m) => m.amp), 1e-6);
    const maxT = Math.max(...modes.map((m) => m.t60), 1e-6);
    for (const m of modes) {
      const x = 4 + (Math.log2(m.f / f0) / maxR) * (w - 8);
      const a = m.amp / maxA;
      g.fillStyle = `rgba(255,120,150,${0.3 + 0.7 * (m.t60 / maxT)})`;
      g.fillRect(x, h - 20 - a * (h - 26), 2, a * (h - 26));
    }
    scope(g, v.scope('out'), 0, h - 18, w, 17, C.audio, 1 / Math.max(0.05, v.param('level')));
    label(g, MATERIALS[Math.round(v.param('material'))]?.name ?? '', 3, 1);
  },
});

export default view;
