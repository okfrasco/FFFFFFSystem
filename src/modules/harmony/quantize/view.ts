/**
 * Quantize: due ottave di tastiera a partire dalla base; le note della scala
 * sono accese (la tonica più chiara), le note appena suonate si illuminano.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { SCALES } from './index';

const BLACK = [1, 3, 6, 8, 10];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const view: ViewFactory = () => ({
  height: 46,
  draw(g, w, h, v) {
    clear(g, w, h);
    const root = Math.round(v.param('root'));
    const steps = SCALES[Math.round(v.param('scale'))]?.steps ?? SCALES[0]!.steps;
    const base = Math.round(v.param('base'));
    const start = base - (base % 12);
    const recent = v.events('note', 0.35);
    const lit = new Map<number, number>();
    for (const e of recent) lit.set(Math.round(e.v), Math.max(lit.get(Math.round(e.v)) ?? 0, 1 - (v.now - e.t) / 0.35));
    const keys = 24;
    const kw = w / keys;
    const top = 12;
    for (let k = 0; k < keys; k++) {
      const note = start + k;
      const pc = note % 12;
      const inScale = steps.includes((pc - root + 12) % 12);
      const glow = lit.get(note) ?? 0;
      g.fillStyle = glow > 0 ? `rgba(255,157,61,${0.35 + 0.65 * glow})` : pc === root ? '#5a6b2a' : inScale ? '#2f3a22' : BLACK.includes(pc) ? '#141418' : '#1c1c22';
      g.fillRect(k * kw + 0.5, top, kw - 1, h - top - 2);
    }
    const last = recent.at(-1);
    label(g, `${NAMES[root]} ${SCALES[Math.round(v.param('scale'))]?.name ?? ''}`, 2, 1, C.white);
    if (last) label(g, `${NAMES[Math.round(last.v) % 12]}${Math.floor(Math.round(last.v) / 12) - 1}`, w - 2, 1, C.event, 'right');
  },
});

export default view;
