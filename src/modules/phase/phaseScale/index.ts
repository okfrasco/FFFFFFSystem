/**
 * Ø Scale — accelera o rallenta la fase per un rapporto num:den (×2, ÷3, 3:4).
 *
 * Senza cambi l'uscita è esattamente ingresso × rapporto: nessuna deriva.
 * Il rapporto cambia solo quando la fase in ingresso passa per un inizio di
 * ciclo (la battuta, se l'ingresso è il Transport). In quel momento l'uscita
 * riparte dall'intero più vicino, così il nuovo pattern comincia sulla battuta.
 * Il salto avviene tra due tick, non dentro un tick: nessuna raffica di step.
 */

import type { ModuleDefinition } from '../../../core/types';

interface ScaleState {
  ratio: number[];
  offset: number[];
}

export const phaseScale: ModuleDefinition = {
  manifest: {
    id: 'phaseScale',
    name: 'Ø Scale',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'in', type: 'phase', poly: true }],
    outputs: [{ id: 'out', type: 'phase', poly: true }],
    params: [
      { id: 'num', label: 'Numeratore', min: 1, max: 32, default: 1, kind: 'discrete' },
      { id: 'den', label: 'Denominatore', min: 1, max: 32, default: 1, kind: 'discrete' },
    ],
    seeded: false,
  },

  create() {
    let s: ScaleState = { ratio: [], offset: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.phase('in');
        if (!input) return;
        const n = input.end.length;
        const out = outputs.phase('out', n);
        for (let v = 0; v < n; v++) {
          const a = input.start[v]!;
          const b = input.end[v]!;
          const ratioAt = (cycle: number) => ctx.discrete('num', cycle, v) / ctx.discrete('den', cycle, v);
          if (s.ratio[v] === undefined) {
            s.ratio[v] = ratioAt(Math.floor(a));
            s.offset[v] = 0;
          }
          const ca = Math.floor(a);
          const cb = Math.floor(b);
          if (ca !== cb) {
            const c = Math.max(ca, cb); // l'intero attraversato
            const next = ratioAt(c);
            const r = s.ratio[v]!;
            if (next !== r) {
              s.offset[v] = Math.round(c * r + s.offset[v]!) - c * next;
              s.ratio[v] = next;
            }
          }
          out.start[v] = a * s.ratio[v]! + s.offset[v]!;
          out.end[v] = b * s.ratio[v]! + s.offset[v]!;
        }
      },
      getState: () => ({ ratio: [...s.ratio], offset: [...s.offset] }),
      setState(state) {
        const st = state as ScaleState;
        s = { ratio: [...st.ratio], offset: [...st.offset] };
      },
    };
  },
};

export default phaseScale;
