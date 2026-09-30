/** Pattern: la linea del genere come piccolo piano roll di 16 step, con lo step corrente. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { GENRES } from '../rhythm/genres';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const genre = GENRES[Math.round(v.param('genre'))] ?? GENRES[0]!;
    const lead = Math.round(v.param('role')) === 1;
    const line = lead ? genre.lead : genre.bass;
    const vals = line.filter((x): x is number => x !== null);
    const lo = Math.min(...vals, 0) - 1;
    const hi = Math.max(...vals, 0) + 1;
    const pos = Math.floor(frac(v.input.value('phase')) * 16);
    const cw = w / 16;
    const lit = v.events('trig', 0.1).length > 0;
    line.forEach((d, i) => {
      if (d === null) return;
      const y = 12 + (1 - (d - lo) / (hi - lo)) * (h - 18);
      g.fillStyle = i === pos && lit ? C.white : C.event;
      g.fillRect(i * cw + 1, y, cw - 2, 4);
    });
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(pos * cw, 10, cw, h - 10);
    label(g, `${genre.name} · ${lead ? 'lead' : 'basso'}`, 2, 0, C.white);
  },
});

export default view;
