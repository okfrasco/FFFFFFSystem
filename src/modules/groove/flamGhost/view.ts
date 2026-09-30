/** Colpi in ingresso (sopra) e in uscita (sotto), sullo stesso tempo: si vede lo spostamento. */

import { C, clear, lanes, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 40,
  draw(g, w, h, v) {
    clear(g, w, h);
    lanes(g, w, h, v.now, 1.5, [
      { label: 'in', events: v.input.events('in', 1.5), color: '#777' },
      { label: 'out', events: v.events('out', 1.5), color: C.event },
    ]);
  },
});

export default view;
