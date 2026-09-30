/** Setaccio: i prossimi 64 step (quelli accesi dal sieve) con lo step corrente, e il periodo. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { parseSieve, type SieveConfig, type Sieve } from './index';

const view: ViewFactory = () => {
  let expr = '';
  let fn: Sieve | null = null;
  return {
    height: 48,
    draw(g, w, h, v) {
      clear(g, w, h);
      const cfg = v.config<SieveConfig>();
      if (cfg.expr !== expr) {
        expr = cfg.expr;
        try {
          fn = parseSieve(expr);
        } catch {
          fn = null;
        }
      }
      if (!fn) {
        label(g, 'espressione non valida', 4, 4, '#ff6b5d');
        return;
      }
      const div = Math.round(v.param('division'));
      const shift = Math.round(v.param('shift'));
      const now = Math.floor(v.input.value('phase') * div);
      const cols = 32;
      const cw = (w - 8) / cols;
      for (let k = 0; k < 64; k++) {
        const n = now + k;
        const x = 4 + (k % cols) * cw;
        const y = 12 + Math.floor(k / cols) * ((h - 14) / 2);
        g.fillStyle = fn(n + shift) ? (k === 0 ? C.white : C.event) : k === 0 ? '#555' : '#22222a';
        g.fillRect(x, y, cw - 1, (h - 14) / 2 - 2);
      }
      label(g, expr, 3, 1, C.text);
    },
  };
};

export default view;
