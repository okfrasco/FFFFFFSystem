/** Mixer: il livello di ciascuno dei 4 ingressi e dell'uscita. */

import { C, clear, label, meter, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    const cols = 5;
    const cw = w / cols;
    for (let k = 1; k <= 4; k++) {
      const rms = v.input.scope(`in${k}`)?.rms ?? 0;
      meter(g, rms * 3 * v.param(`level${k}`), (k - 1) * cw + cw * 0.3, 4, cw * 0.4, h - 16, C.audio);
      label(g, String(k), (k - 1) * cw + cw / 2, h - 11, C.dim, 'center');
    }
    meter(g, (v.scope('out')?.rms ?? 0) * 3, 4 * cw + cw * 0.25, 4, cw * 0.5, h - 16, C.white);
    label(g, 'out', 4 * cw + cw / 2, h - 11, C.text, 'center');
  },
});

export default view;
