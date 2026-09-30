/**
 * Tabella 2D — una matrice di valori 0–1 letta da due fasi: X sceglie la
 * colonna, Y la riga. Con due fasi a velocità diverse (una battuta e tre
 * battute, o una piegata) la lettura disegna percorsi che si ripetono di rado.
 * `smooth` interpola tra le celle (bilineare). Un trigger a ogni cambio di
 * cella, con il valore della cella nuova.
 */

import { mod, phaseAt, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export interface Table2dConfig {
  w: number;
  h: number;
  /** Righe una dopo l'altra: cells[y * w + x]. */
  cells: number[];
}

export function readTable(c: Table2dConfig, x: number, y: number, smooth: number): number {
  const fx = mod(x, 1) * c.w;
  const fy = mod(y, 1) * c.h;
  const ix = Math.floor(fx) % c.w;
  const iy = Math.floor(fy) % c.h;
  const at = (i: number, j: number) => c.cells[(j % c.h) * c.w + (i % c.w)] ?? 0;
  const tx = (fx - Math.floor(fx)) * smooth;
  const ty = (fy - Math.floor(fy)) * smooth;
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
  const bot = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
  return top + (bot - top) * ty;
}

export const table2d: ModuleDefinition = {
  manifest: {
    id: 'table2d',
    name: 'Tabella 2D',
    category: 'data',
    rate: 'control',
    inputs: [
      { id: 'x', type: 'phase' },
      { id: 'y', type: 'phase' },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'smooth', label: 'Smussa', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'lo', label: 'Minimo', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: -1, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: {
    w: 8,
    h: 4,
    cells: [
      1, 0, 0.5, 0, 0.8, 0, 0.3, 0.6,
      0.2, 0.9, 0, 0.4, 0, 1, 0, 0.5,
      0.7, 0, 0.6, 0, 1, 0.3, 0.8, 0,
      0, 0.5, 0, 1, 0.2, 0, 0.9, 0.4,
    ],
  } satisfies Table2dConfig,
  create(init) {
    let cfg = init.config as Table2dConfig;
    return {
      process(ctx, inputs, outputs) {
        const px = inputs.phase('x');
        const py = inputs.phase('y');
        if (!px || cfg.w < 1 || cfg.h < 1) return;
        const xs = px.start[0]!;
        const xe = px.end[0]!;
        const ys = py?.start[0] ?? 0;
        const ye = py?.end[0] ?? 0;
        const lo = ctx.param('lo');
        const hi = ctx.param('hi');
        const val = (x: number, y: number) => lo + (hi - lo) * readTable(cfg, x, y, 0);
        // cambi di colonna e di riga nel tick, in ordine di tempo
        const times = [
          ...stepCrossings(xs, xe, cfg.w, ctx.t0, ctx.t1).map((h) => h.t),
          ...stepCrossings(ys, ye, cfg.h, ctx.t0, ctx.t1).map((h) => h.t),
        ].sort((a, b) => a - b);
        const trig = outputs.control('trig');
        let last = -1;
        for (const t of times) {
          if (t === last) continue; // colonna e riga cambiano insieme: un solo trigger
          last = t;
          const x = phaseAt(xs, xe, ctx.t0, ctx.t1, t) + 1e-9 * Math.sign(xe - xs);
          const y = phaseAt(ys, ye, ctx.t0, ctx.t1, t) + 1e-9 * Math.sign(ye - ys);
          trig.events.push({ kind: 'trig', t, voice: 0, vel: 1, value: val(x, y) });
        }
        outputs.control('out').values[0] = lo + (hi - lo) * readTable(cfg, xe, ye, ctx.param('smooth'));
      },
      setConfig(c) {
        cfg = c as Table2dConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default table2d;
