/** Voci: le note che arrivano come piccolo piano roll, e quante voci sono accese adesso. */

import { C, clear, label, roll, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const notes = v.input.events('note', 3);
    const pitches = notes.map((n) => n.v);
    const lo = Math.min(...pitches, 60) - 2;
    const hi = Math.max(...pitches, 60) + 2;
    roll(g, notes, v.now, 3, 0, 2, w - 14, h - 4, C.event, [lo, hi]);
    // la somma dei gate = voci accese
    const gate = v.scope('gate');
    let active = 0;
    if (gate) for (const s of gate.samples) active = Math.max(active, Math.round(s));
    const n = Math.round(v.param('voices'));
    for (let i = 0; i < n && i < 16; i++) {
      g.fillStyle = i < active ? C.value : '#26262e';
      g.fillRect(w - 10, h - 4 - (i + 1) * ((h - 6) / Math.min(n, 16)), 7, (h - 6) / Math.min(n, 16) - 1);
    }
    label(g, `${active}/${n}`, w - 14, 2, C.white, 'right');
  },
});

export default view;
