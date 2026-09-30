/** Sequenza numerica: i prossimi 32 termini come barre; in modo appartenenza solo quelli che suonano. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { SEQUENCES, seqMember, seqValue, type NumberSeqConfig } from './index';

const view: ViewFactory = () => ({
  height: 44,
  draw(g, w, h, v) {
    clear(g, w, h);
    const kind = Math.round(v.param('sequence'));
    const m = Math.max(1, Math.round(v.param('mod')));
    const steps = Math.max(1, Math.round(v.param('steps')));
    const member = Math.round(v.param('rhythm')) === 1;
    const n0 = Math.max(0, Math.floor(v.input.value('phase') * steps)) + Math.round(v.param('offset'));
    const custom = v.config<NumberSeqConfig>().values;
    const cw = w / 32;
    for (let i = 0; i < 32; i++) {
      const n = n0 + i;
      if (member && !seqMember(kind, n)) continue;
      const x = seqValue(kind, n, m, custom);
      const bh = ((x + 1) / m) * (h - 12);
      g.fillStyle = i === 0 ? C.white : C.value;
      g.fillRect(i * cw + 1, h - 2 - bh, cw - 2, bh);
    }
    label(g, `${SEQUENCES[kind]} mod ${m}`, 3, 1, C.white);
  },
});

export default view;
