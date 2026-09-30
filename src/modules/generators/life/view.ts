/** Game of Life: la griglia, con la colonna che viene letta adesso. */

import { C, clear, label, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 64,
  draw(g, w, h, v) {
    clear(g, w, h);
    const st = v.state<{ grid: number[][]; col: number; generation: number }>();
    if (!st) return;
    const H = st.grid.length;
    const W = st.grid[0]!.length;
    const size = Math.min((w - 70) / W, (h - 4) / H);
    const col = (st.col - 1 + W) % W; // l'ultima colonna letta
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        g.fillStyle = st.grid[y]![x] ? (x === col ? C.white : C.value) : x === col ? '#2a2a33' : '#18181e';
        g.fillRect(2 + x * size, 2 + y * size, size - 1, size - 1);
      }
    }
    label(g, `gen ${st.generation}`, W * size + 8, 4, C.white);
    label(g, `${Math.round(v.value('density') * 100)}% vive`, W * size + 8, 18);
  },
});

export default view;
