/** Ratchet: i colpi in ingresso e quelli che escono, con le raffiche dentro lo step. */

import { C, clear, label, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 2, [
      { label: 'in', events: v.input.events('trig', 2), color: '#777' },
      { label: 'out', events: v.events('trig', 2), color: C.event },
    ]);
    label(g, `×${Math.round(v.param('repeats'))} · ${Math.round(v.param('prob') * 100)}%`, w - 2, 1, C.white, 'right');
  },
});

export default view;
