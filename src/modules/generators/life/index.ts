/**
 * Game of Life — la griglia di Conway letta come sequencer: a ogni step si
 * legge una colonna (da sinistra a destra) e ogni cella viva di quella colonna
 * è un trigger sulla voce della sua riga (uscita poly, righe = voci). La
 * griglia evolve di una generazione a ogni giro completo, o a ogni step.
 * Se la vita si spegne o si ferma, si riparte da una griglia nuova (dal seed).
 */

import { clockHits } from '../../../core/phase';
import type { Rng } from '../../../core/rng';
import type { ModuleDefinition } from '../../../core/types';

export function lifeStep(grid: number[][]): number[][] {
  const h = grid.length;
  const w = grid[0]!.length;
  return grid.map((row, y) =>
    row.map((c, x) => {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += grid[(y + dy + h) % h]![(x + dx + w) % w]!;
      return n === 3 || (c === 1 && n === 2) ? 1 : 0;
    }),
  );
}

function randomGrid(rng: Rng, w: number, h: number, density: number): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => (rng.chance(density) ? 1 : 0)));
}

interface LifeState {
  grid: number[][];
  prev: string;
  col: number;
  counter: number;
  generation: number;
}

export const life: ModuleDefinition = {
  manifest: {
    id: 'life',
    name: 'Game of Life',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'density', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'width', label: 'Colonne', min: 4, max: 32, default: 16, kind: 'discrete' },
      { id: 'height', label: 'Righe (voci)', min: 2, max: 16, default: 8, kind: 'discrete' },
      { id: 'density', label: 'Densità iniziale', min: 0.05, max: 0.8, default: 0.3, kind: 'continuous' },
      { id: 'evolve', label: 'Evolve', min: 0, max: 1, default: 0, kind: 'discrete', options: ['a ogni giro', 'a ogni step'] },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    let s: LifeState | null = null;
    return {
      process(ctx, inputs, outputs) {
        const W = ctx.discrete('width', 0);
        const H = ctx.discrete('height', 0);
        const fresh = () => randomGrid(ctx.rng, W, H, ctx.param('density'));
        if (!s || s.grid.length !== H || s.grid[0]!.length !== W) s = { grid: fresh(), prev: '', col: 0, counter: s?.counter ?? 0, generation: 0 };
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig', H);
        const evolveEachStep = ctx.discrete('evolve', ctx.tick) === 1;
        for (const hit of hits) {
          for (let y = 0; y < H; y++) if (s.grid[y]![s.col]) trig.events.push({ kind: 'trig', t: hit.t, voice: y, vel: hit.vel, value: y });
          s.col = (s.col + 1) % W;
          if (evolveEachStep || s.col === 0) {
            const next = lifeStep(s.grid);
            const key = next.map((r) => r.join('')).join('|');
            const alive = next.some((r) => r.some(Boolean));
            // spenta o ferma: si riparte
            s.grid = !alive || key === s.prev ? fresh() : next;
            s.prev = key;
            s.generation++;
          }
        }
        const alive = s.grid.reduce((a, r) => a + r.reduce((b, c) => b + c, 0), 0);
        outputs.control('density').values[0] = alive / (W * H);
      },
      getState: () => (s ? { ...s, grid: s.grid.map((r) => [...r]) } : null),
      setState(state) {
        const st = state as LifeState | null;
        s = st ? { ...st, grid: st.grid.map((r) => [...r]) } : null;
      },
    };
  },
};

export default life;
