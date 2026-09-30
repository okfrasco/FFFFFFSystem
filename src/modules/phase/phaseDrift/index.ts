/**
 * Ø Drift — il tempo che respira: la fase deriva avanti e indietro in modo
 * lento e continuo (rumore liscio, riproducibile dal seed), non a scatti per
 * nota. Un gruppo di nodi dietro un Ø Drift si muove rispetto agli altri.
 *
 *   amount       scarto massimo, in cicli della fase (0.02 sulla battuta ≈ 40 ms a 120 BPM)
 *   rate         velocità della deriva, in Hz
 *   correlation  1 = tutte le voci derivano insieme, 0 = ognuna per conto suo
 *
 * La fase in uscita non torna mai indietro: se la deriva la farebbe
 * arretrare, rallenta soltanto. `offset` è lo scarto attuale (per vederlo o
 * modularci altro).
 */

import { hash01 } from '../../../core/rng';
import type { ModuleDefinition } from '../../../core/types';

/** Rumore liscio in [−1, 1] al tempo x (punti casuali agli interi, interpolazione coseno). */
export function smoothNoise(seed: number, stream: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, stream, i) * 2 - 1;
  const b = hash01(seed, stream, i + 1) * 2 - 1;
  const t = (1 - Math.cos(Math.PI * f)) / 2;
  return a + (b - a) * t;
}

interface DriftState {
  /** Fase in uscita e in ingresso alla fine del tick precedente. */
  last: number[];
  lastIn: number[];
}

export const phaseDrift: ModuleDefinition = {
  manifest: {
    id: 'phaseDrift',
    name: 'Ø Drift',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [
      { id: 'out', type: 'phase', poly: true },
      { id: 'offset', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'amount', label: 'Quantità', min: 0, max: 0.25, default: 0.02, kind: 'continuous', unit: 'cicli' },
      { id: 'rate', label: 'Velocità', min: 0.01, max: 4, default: 0.2, kind: 'continuous', curve: 'exp', unit: 'Hz' },
      { id: 'correlation', label: 'Correlazione', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    const seed = init.seed;
    let s: DriftState = { last: [], lastIn: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        const offset = outputs.control('offset', n);
        for (let v = 0; v < n; v++) {
          const amount = ctx.param('amount', v);
          const rate = ctx.param('rate', v);
          const corr = ctx.param('correlation', v);
          const d = (t: number) => {
            const shared = smoothNoise(seed, 0, t * rate);
            const own = smoothNoise(seed, v + 1, t * rate);
            return amount * (corr * shared + (1 - corr) * own);
          };
          const a = input.start[v]!;
          const b = input.end[v]!;
          // se l'ingresso è saltato (es. Ø Scale che cambia rapporto) si segue il salto
          const continuous = s.lastIn[v] === a && s.last[v] !== undefined;
          const start = continuous ? s.last[v]! : a + d(ctx.t0);
          let end = b + d(ctx.t1);
          // mai all'indietro: al più rallenta (se la fase in ingresso avanza)
          if (b >= a) end = Math.max(end, start + 0.2 * (b - a));
          out.start[v] = start;
          out.end[v] = end;
          s.last[v] = end;
          s.lastIn[v] = b;
          offset.values[v] = end - b;
        }
      },
      getState: () => ({ last: [...s.last], lastIn: [...s.lastIn] }),
      setState(state) {
        const st = state as DriftState;
        s = { last: [...st.last], lastIn: [...(st.lastIn ?? [])] };
      },
    };
  },
};

export default phaseDrift;
