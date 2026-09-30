/** Cerchio delle quinte: la scala sul cerchio, la tonica in bianco, e il nome della tonalità. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { fifthsCircle } from '../draw';
import { MODES, NOTE_NAMES, pc } from '../theory';

const view: ViewFactory = () => ({
  height: 84,
  draw(g, w, h, v) {
    clear(g, w, h);
    const scale = v.voices('scale');
    const root = pc(v.value('root'));
    const r = Math.min(w / 2, h / 2) - 12;
    fifthsCircle(g, w / 2, h / 2 + 4, r, (p) => (scale[p] ?? 0) > 0.5, (p) => (p === root ? C.white : null));
    // il modo: quale dei sette ha gli stessi intervalli dalla tonica
    const steps: number[] = [];
    for (let i = 0; i < 12; i++) if ((scale[pc(root + i)] ?? 0) > 0.5) steps.push(i);
    const mode = MODES.find((x) => x.steps.join() === steps.join());
    label(g, `${NOTE_NAMES[root]} ${mode?.name ?? ''}`, 3, 0, C.white);
    if (v.events('change', 0.3).length) label(g, '●', w - 3, 0, C.event, 'right');
  },
});

export default view;
