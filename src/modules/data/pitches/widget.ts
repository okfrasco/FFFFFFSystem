/**
 * Piano roll di Pitches: una colonna per step, due ottave visibili (▲ ▼ le
 * spostano). Clic su una casella: quella nota; clic sulla nota già messa:
 * pausa. Trascinando si disegna.
 */

import type { PitchesConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf, inputPhase, onDrag } from '../../../ui/editor/widgetKit';

const ROWS = 25;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
export const noteName = (p: number) => `${NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 2}`;

export default function pitchesWidget(api: EditorApi, nodeId: string): Widget {
  const cfg = () => configOf<PitchesConfig>(api, nodeId);
  const low = () => cfg().low ?? 48;
  const write = (c: Partial<PitchesConfig>) => api.setConfig(nodeId, { ...cfg(), ...c });
  const p = canvasPanel(
    '<span>note</span><button data-a="down">▼</button><button data-a="up">▲</button><button data-a="-">−</button><button data-a="+">+</button>',
    96,
    (a) => {
      const n = cfg().notes;
      if (a === '-' && n.length > 1) write({ notes: n.slice(0, -1) });
      else if (a === '+' && n.length < 64) write({ notes: [...n, -1] });
      else if (a === 'up' && low() < 108) write({ low: low() + 12 });
      else if (a === 'down' && low() > 0) write({ low: low() - 12 });
      else return;
      api.commit();
    },
  );
  let notes: number[] = [];
  let erase = false;
  let last = -1;
  const pick = (e: PointerEvent) => {
    const { x, y } = p.at(e);
    return { i: Math.floor(x * notes.length), pitch: low() + (ROWS - 1 - Math.floor(y * ROWS)) };
  };
  onDrag(
    p.canvas,
    (e) => {
      notes = [...cfg().notes];
      const { i, pitch } = pick(e);
      erase = notes[i] === pitch;
      notes[i] = erase ? -1 : pitch;
      last = i;
      write({ notes: [...notes] });
    },
    (e) => {
      const { i, pitch } = pick(e);
      if (i === last && !erase && notes[i] === pitch) return;
      notes[i] = erase ? -1 : pitch;
      last = i;
      write({ notes: [...notes] });
    },
    () => api.commit(),
  );
  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      const c = cfg();
      const lo = low();
      const rh = h / ROWS;
      for (let r = 0; r < ROWS; r++) {
        const pitch = lo + ROWS - 1 - r;
        g.fillStyle = BLACK.has(pitch % 12) ? '#121216' : pitch % 12 === 0 ? '#22222a' : '#18181e';
        g.fillRect(0, r * rh, w, rh - 0.5);
      }
      g.fillStyle = '#555';
      g.font = '8px ui-monospace, monospace';
      g.fillText(noteName(lo), 2, h - 2);
      const cw = w / c.notes.length;
      const ph = inputPhase(api, nodeId, 'phase', now);
      const cur = ph === null ? -1 : Math.floor(ph * c.notes.length);
      c.notes.forEach((pitch, i) => {
        if (i === cur) {
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(i * cw, 0, cw, h);
        }
        if (pitch < 0) return;
        const r = lo + ROWS - 1 - pitch;
        const y = Math.max(0, Math.min(ROWS - 1, r)) * rh;
        g.fillStyle = r < 0 || r >= ROWS ? '#555' : i === cur ? '#fff' : '#5ad1ff';
        g.fillRect(i * cw + 1, y, cw - 2, rh);
      });
    },
  };
}
