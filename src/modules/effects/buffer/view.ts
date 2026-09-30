/** Buffer: il modo, se sta suonando dal buffer (●) e il segnale. */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { BUFFER_MODES } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    scope(g, v.scope('out'), 0, 4, w, h - 8, C.audio);
    const on = v.param('active') >= 0.5 || v.input.value('hold') > 0.5;
    label(g, BUFFER_MODES[Math.round(v.param('mode'))] ?? '', 3, 1, C.text);
    if (on) label(g, '● buffer', w - 3, 1, '#ff4d5e', 'right');
  },
});

export default view;
