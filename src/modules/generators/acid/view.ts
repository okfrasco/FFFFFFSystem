/**
 * Acid: i 16 step alla 303 — altezza della nota, accenti in bianco, slide
 * come trattino verso lo step dopo, pause vuote — e lo step corrente.
 */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import type { AcidStep } from './index';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ steps: AcidStep[] }>();
    if (!st) return;
    const notes = st.steps.map((s) => s.note).filter((n): n is number => n !== null);
    const lo = Math.min(...notes, 0) - 1;
    const hi = Math.max(...notes, 12) + 1;
    const pos = Math.floor(frac(v.input.value('phase')) * 16);
    const cw = w / 16;
    const Y = (n: number) => 12 + (1 - (n - lo) / (hi - lo)) * (h - 18);
    st.steps.forEach((s, i) => {
      if (i === pos) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(i * cw, 10, cw, h - 10);
      }
      if (s.note === null) return;
      g.fillStyle = s.accent ? C.white : C.event;
      g.fillRect(i * cw + 1, Y(s.note) - 2, s.slide ? cw : cw - 2, 4);
      if (s.slide) {
        const next = st.steps[(i + 1) % 16]!;
        if (next.note !== null) {
          g.strokeStyle = C.event;
          g.beginPath();
          g.moveTo((i + 1) * cw, Y(s.note));
          g.lineTo((i + 1) * cw + 2, Y(next.note));
          g.stroke();
        }
      }
    });
    label(g, 'acid', 2, 0, C.white);
  },
});

export default view;
