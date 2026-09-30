/** Condizione: i trigger in ingresso (sopra) e quelli che passano (sotto), con la condizione. */

import { C, clear, label, lanes, type ViewFactory } from '../../../ui/editor/viewKit';
import { CONDITIONS } from './index';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 8, [
      { label: 'in', events: v.input.events('trig', 8), color: '#777' },
      { label: 'out', events: v.events('trig', 8), color: C.event },
    ]);
    const mode = Math.round(v.param('mode'));
    const text = mode <= 1 ? `${mode ? 'NOT ' : ''}${Math.round(v.param('a'))}:${Math.round(v.param('b'))}` : mode === 6 ? `${Math.round(v.param('prob') * 100)}%` : CONDITIONS[mode];
    label(g, text ?? '', w - 2, 1, C.white, 'right');
  },
});

export default view;
