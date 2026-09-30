/** Porte logiche: A, B e il risultato, una corsia sotto l'altra. */

import { C, clear, label, lanes, type ViewFactory } from '../../../ui/editor/viewKit';
import { LOGIC_OPS } from './index';

const view: ViewFactory = () => ({
  height: 54,
  draw(g, w, h, v) {
    clear(g, w, h);
    const op = Math.round(v.param('op'));
    lanes(g, w, h, v.now, 2, [
      { label: 'A', events: v.input.events('a', 2), history: v.input.history('a', 2, 80), color: '#777' },
      ...(op === 3 ? [] : [{ label: 'B', events: v.input.events('b', 2), history: v.input.history('b', 2, 80), color: '#777' }]),
      { label: '=', events: v.events('trig', 2), history: v.history('gate', 2, 80), color: C.gate },
    ]);
    label(g, LOGIC_OPS[op] ?? '', w - 2, 1, C.white, 'right');
  },
});

export default view;
