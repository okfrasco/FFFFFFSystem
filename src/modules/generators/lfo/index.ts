/**
 * LFO — forme base agganciate alla fase: `cycles` oscillazioni per ciclo
 * della fase in ingresso (sulla battuta: 4 = una per beat, 0.25 = una ogni
 * quattro battute). Il valore è sempre allineato al tempo, anche piegato.
 *
 *   shape     sine, triangolo, rampa su, rampa giù, quadra
 *   offset    fase iniziale (0–1)
 *   skew      sposta il punto più alto del triangolo e la larghezza della quadra
 *   polarity  0…1 oppure −1…1
 *
 * Un trigger a ogni inizio di ciclo dell'LFO.
 */

import { stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export const LFO_SHAPES = ['sine', 'triangolo', 'rampa su', 'rampa giù', 'quadra'] as const;

/** Valore dell'LFO (0–1) a una posizione del suo ciclo (0–1). */
export function lfoShape(shape: number, u: number, skew: number): number {
  const k = Math.max(0.01, Math.min(0.99, skew));
  switch (shape) {
    case 0:
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
    case 1:
      return u < k ? u / k : (1 - u) / (1 - k);
    case 2:
      return u;
    case 3:
      return 1 - u;
    default:
      return u < k ? 1 : 0;
  }
}

export const lfo: ModuleDefinition = {
  manifest: {
    id: 'lfo',
    name: 'LFO',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'out', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'shape', label: 'Forma', min: 0, max: LFO_SHAPES.length - 1, default: 0, kind: 'discrete', options: [...LFO_SHAPES] },
      { id: 'cycles', label: 'Cicli', min: 0.0625, max: 16, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'offset', label: 'Offset', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'skew', label: 'Skew', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'polarity', label: 'Polarità', min: 0, max: 1, default: 0, kind: 'discrete', options: ['0…1', '−1…1'] },
    ],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const n = ph.end.length;
        const out = outputs.control('out', n);
        const trig = outputs.control('trig', n);
        for (let v = 0; v < n; v++) {
          const cycles = ctx.param('cycles', v);
          const offset = ctx.param('offset', v);
          const a = ph.start[v]! * cycles + offset;
          const b = ph.end[v]! * cycles + offset;
          for (const hit of stepCrossings(a, b, 1, ctx.t0, ctx.t1)) trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel: 1, value: hit.step });
          const u = b - Math.floor(b);
          const y = lfoShape(ctx.discrete('shape', Math.floor(b), v), u, ctx.param('skew', v));
          out.values[v] = ctx.discrete('polarity', Math.floor(b), v) === 1 ? y * 2 - 1 : y;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default lfo;
