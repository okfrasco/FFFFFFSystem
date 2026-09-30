/** Rhythm: la griglia del genere (luminosità = probabilità), lo step corrente e i colpi che suonano. */

import { C, clear, frac, label, type ViewFactory } from '../../../ui/editor/viewKit';
import { GENRES, INSTRUMENTS, stepProb } from './genres';

export function drawGenreGrid(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  probs: (inst: (typeof INSTRUMENTS)[number], i: number) => number,
  pos: number,
  lit: (inst: string) => boolean,
): void {
  const top = 12;
  const rh = (h - top) / INSTRUMENTS.length;
  const cw = (w - 30) / 16;
  INSTRUMENTS.forEach((inst, r) => {
    label(g, inst, 1, top + r * rh + rh / 2 - 5, C.dim);
    for (let i = 0; i < 16; i++) {
      const p = probs(inst, i);
      const here = i === pos;
      g.fillStyle = here && lit(inst) ? C.white : p > 0 ? `rgba(255,157,61,${0.12 + 0.88 * p})` : here ? '#2a2a33' : '#18181e';
      g.fillRect(30 + i * cw, top + r * rh + 1, cw - 1.5, rh - 2);
    }
  });
}

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const genre = GENRES[Math.round(v.param('genre'))] ?? GENRES[0]!;
    const density = v.param('density');
    const pos = Math.floor(frac(v.input.value('phase')) * 16);
    drawGenreGrid(g, w, h, (inst, i) => stepProb(genre.drums[inst][i]!, density), pos, (inst) => v.events(inst, 0.1).length > 0);
    label(g, genre.name, 1, 0, C.white);
  },
});

export default view;
