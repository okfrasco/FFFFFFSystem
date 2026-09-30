/** Additivo: lo spettro effettivo (con inclinazione, dispari/pari e stiramento sulle ascisse) e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { partialAmp, partialRatio, type AdditiveConfig } from './index';

const view: ViewFactory = () => ({
  height: 52,
  draw(g, w, h, v) {
    clear(g, w, h);
    const amps = v.config<AdditiveConfig>()?.amps ?? [];
    const count = Math.round(v.param('partials'));
    const tilt = v.param('tilt');
    const oe = v.param('oddEven');
    const stretch = v.param('stretch');
    const maxR = partialRatio(count, stretch) + 1;
    let max = 0;
    for (let k = 1; k <= count; k++) max = Math.max(max, partialAmp(amps, k, tilt, oe));
    for (let k = 1; k <= count; k++) {
      const a = partialAmp(amps, k, tilt, oe) / (max || 1);
      const x = 3 + (partialRatio(k, stretch) / maxR) * (w - 6);
      g.fillStyle = C.audio;
      g.fillRect(x, h - 20 - a * (h - 24), 1.5, a * (h - 24));
    }
    scope(g, v.scope('out'), 0, h - 18, w, 17, C.audio, 1 / Math.max(0.05, v.param('level')));
    label(g, `${count} parziali`, 3, 1);
  },
});

export default view;
