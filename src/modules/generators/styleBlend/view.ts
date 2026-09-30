/** Style Blend: la griglia miscelata, con la barra della miscela tra i due generi. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { GENRES, stepProb } from '../rhythm/genres';
import { drawGenreGrid } from '../rhythm/view';
import { blendProb } from './index';

const view: ViewFactory = () => ({
  height: 70,
  draw(g, w, h, v) {
    clear(g, w, h);
    const A = GENRES[Math.round(v.param('a'))] ?? GENRES[0]!;
    const B = GENRES[Math.round(v.param('b'))] ?? GENRES[0]!;
    const blend = v.param('blend');
    const density = v.param('density');
    const pos = Math.floor(frac(v.input.value('phase')) * 16);
    drawGenreGrid(g, w, h - 6, (inst, i) => stepProb(blendProb(A.drums[inst][i]!, B.drums[inst][i]!, blend), density), pos, (inst) => v.events(inst, 0.1).length > 0);
    g.fillStyle = C.grid;
    g.fillRect(30, h - 4, w - 30, 2);
    g.fillStyle = C.white;
    g.fillRect(30 + blend * (w - 32), h - 6, 3, 6);
    label(g, `${Math.round((1 - blend) * 100)}% ${A.name} · ${Math.round(blend * 100)}% ${B.name}`, 1, 0, C.white);
  },
});

export default view;
