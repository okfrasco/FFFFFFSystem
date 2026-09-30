/**
 * Motif — una cella melodica breve (dal seed) che si ripete e si trasforma:
 * a ogni ripetizione, con probabilità `variation`, la cella passa per una
 * trasformazione classica —
 *   trasposizione (una sequenza), inversione, retrogrado, spostamento
 *   ritmico, abbellimento (una nota in più di passaggio)
 * — e ogni `return` ripetizioni torna all'originale, perché il motivo si
 * riconosca. Esce un trigger per nota con il grado come valore.
 */

import { stepCrossings } from '../../../core/phase';
import type { Rng } from '../../../core/rng';
import type { ModuleDefinition } from '../../../core/types';

export const TRANSFORMS = ['originale', 'trasposto', 'inverso', 'retrogrado', 'spostato', 'abbellito'] as const;

/** Una cella: per ogni step della cella, un grado o null (pausa). */
export type Cell = (number | null)[];

export function makeCell(rng: Rng, length: number, range: number, rests: number): Cell {
  const cell: Cell = [];
  let deg = 0;
  for (let i = 0; i < length; i++) {
    if (i > 0 && rng.chance(rests)) {
      cell.push(null);
      continue;
    }
    cell.push(deg);
    deg = Math.max(-range, Math.min(range, deg + rng.pick([-2, -1, -1, 1, 1, 2, 3])));
  }
  return cell;
}

export function transformCell(cell: Cell, kind: number, amount: number): Cell {
  switch (kind) {
    case 1:
      return cell.map((d) => (d === null ? null : d + amount));
    case 2: {
      const first = cell.find((d) => d !== null) ?? 0;
      return cell.map((d) => (d === null ? null : 2 * first - d));
    }
    case 3:
      return [...cell].reverse();
    case 4:
      return cell.map((_, i) => cell[(i - 1 + cell.length) % cell.length]!);
    case 5: {
      // una nota di passaggio nella prima pausa, tra le note vicine
      const out = [...cell];
      const k = out.findIndex((d, i) => d === null && i > 0);
      if (k > 0) {
        const prev = out.slice(0, k).reverse().find((d) => d !== null) ?? 0;
        out[k] = prev + (amount >= 0 ? 1 : -1);
      }
      return out;
    }
    default:
      return [...cell];
  }
}

interface MotifState {
  cell: Cell;
  current: Cell;
  kind: number;
  rep: number;
  lastRep: number;
}

export const motif: ModuleDefinition = {
  manifest: {
    id: 'motif',
    name: 'Motif',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'length', label: 'Lunghezza', min: 2, max: 16, default: 6, kind: 'discrete', unit: 'step' },
      { id: 'range', label: 'Ambito', min: 1, max: 12, default: 4, kind: 'discrete', unit: 'gradi' },
      { id: 'rests', label: 'Pause', min: 0, max: 0.8, default: 0.25, kind: 'continuous' },
      { id: 'variation', label: 'Variazione', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'return', label: 'Ritorno ogni', min: 0, max: 16, default: 4, kind: 'discrete' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 32, default: 16, kind: 'discrete' },
    ],
    seeded: true,
  },
  create() {
    let s: MotifState | null = null;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const L = ctx.discrete('length', 0);
        if (!s || s.cell.length !== L) {
          const cell = makeCell(ctx.rng, L, ctx.discrete('range', 0), ctx.param('rests'));
          s = { cell, current: cell, kind: 0, rep: 0, lastRep: -1 };
        }
        const out = outputs.control('trig');
        let last = NaN;
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, ctx.discrete('steps', 0), ctx.t0, ctx.t1)) {
          const rep = Math.floor(hit.step / L);
          if (rep !== s.lastRep) {
            // una ripetizione nuova: si sceglie la trasformazione
            s.lastRep = rep;
            s.rep = rep;
            const ret = ctx.discrete('return', rep);
            if (ret > 0 && rep % ret === 0) s.kind = 0;
            else if (ctx.rng.chance(ctx.param('variation'))) s.kind = ctx.rng.int(1, TRANSFORMS.length);
            else s.kind = 0;
            s.current = transformCell(s.cell, s.kind, ctx.rng.pick([-2, -1, 1, 2, 3]));
          }
          const d = s.current[((hit.step % L) + L) % L];
          if (d === null || d === undefined) continue;
          last = d;
          out.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.step % L === 0 ? 1 : 0.8, value: d });
        }
        if (Number.isFinite(last)) outputs.control('value').values[0] = last;
      },
      getState: () => (s ? { ...s, cell: [...s.cell], current: [...s.current] } : null),
      setState(state) {
        const st = state as MotifState | null;
        s = st ? { ...st, cell: [...st.cell], current: [...st.current] } : null;
      },
    };
  },
};

export default motif;
