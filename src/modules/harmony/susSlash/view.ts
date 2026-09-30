/**
 * Sus Slash: in alto i bassi utilizzabili dal più scuro al più luminoso (il
 * scelto in bianco, i più tosti in arancio), sotto l'accordo sulla tastiera.
 */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { keys } from '../draw';
import { NOTE_NAMES, SUS_VARIANTS, pc } from '../theory';
import { susChord } from './index';

const view: ViewFactory = () => ({
  height: 74,
  draw(g, w, h, v) {
    clear(g, w, h);
    const root = Math.round(v.param('root'));
    const variant = Math.round(v.param('variant'));
    const r = susChord(root, variant, Math.round(v.param('notes')), v.param('bass'), v.param('tension'), Math.round(v.param('octave')));
    const all = susChord(root, variant, 3, 0, 1, 36).basses;
    const vr = SUS_VARIANTS[variant]!;
    const bw = (w - 4) / all.length;
    all.forEach((p, i) => {
      const on = p === pc(r.bass);
      const usable = r.basses.includes(p);
      const tough = vr.tough.includes(pc(p - root));
      g.fillStyle = on ? C.white : !usable ? '#1a1a1f' : tough ? '#7a4a1a' : '#2c3440';
      g.fillRect(2 + i * bw, 12, bw - 1, 12);
      g.fillStyle = on ? '#000' : usable ? C.text : C.dim;
      g.font = '8px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(NOTE_NAMES[p]!, 2 + i * bw + bw / 2, 18.5);
    });
    label(g, `${NOTE_NAMES[root]}${vr.name}/${NOTE_NAMES[pc(r.bass)]}`, 3, 0, C.white);
    label(g, 'scuro → luminoso', w - 3, 0, C.dim, 'right');
    const lo = r.bass - (r.bass % 12);
    const inScale = (p: number) => r.scale.includes(p);
    keys(g, 2, 28, w - 4, h - 30, lo, lo + 35, inScale, (n) => (n === r.chord[0] ? C.white : r.chord.includes(n) ? C.value : null));
  },
});

export default view;
