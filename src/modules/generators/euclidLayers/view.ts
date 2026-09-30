/** Euclideo multistrato: il cerchio con accenti (bianchi), colpi normali, ghost (piccoli) e fill. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { layerAt } from './index';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const steps = Math.max(1, Math.round(v.param('steps')));
    const pulses = Math.min(steps, Math.round(v.param('pulses')));
    const rot = Math.round(v.param('rotate'));
    const phase = v.input.value('phase');
    const cycle = Math.floor(phase);
    const every = Math.round(v.param('fillEvery'));
    const fill = every > 0 && ((cycle % every) + every) % every === every - 1;
    const pos = Math.floor(frac(phase) * steps);
    const cx = h / 2;
    const cy = h / 2;
    const r = h / 2 - 7;
    for (let s = 0; s < steps; s++) {
      const i = (((s - rot) % steps) + steps) % steps;
      const layer = layerAt(i, steps, pulses, Math.min(pulses, Math.round(v.param('accents'))), Math.round(v.param('ghosts')), fill, Math.round(v.param('fillPulses')));
      const a = -Math.PI / 2 + (s / steps) * Math.PI * 2;
      const size = layer === 'accent' ? 4 : layer === 'normal' ? 3 : layer ? 2 : 1.5;
      g.fillStyle = layer === 'accent' ? C.white : layer === 'normal' ? C.event : layer === 'fill' ? C.gate : layer === 'ghost' ? '#8a6030' : '#2a2a30';
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s === pos ? size + 1.5 : size, 0, Math.PI * 2);
      g.fill();
    }
    label(g, `E(${pulses},${steps})`, h + 6, 8, C.white);
    label(g, `acc ${Math.round(v.param('accents'))} · ghost ${Math.round(v.param('ghosts'))}`, h + 6, 22);
    if (fill) label(g, 'FILL', h + 6, 36, C.gate);
  },
});

export default view;
