/**
 * Lag — slew: il segnale in uscita insegue quello in ingresso, con tempi
 * separati per la salita e la discesa. Esponenziale (tempo per arrivare
 * al 63%) o lineare (tempo per percorrere un'unità intera).
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

/** Un passo di slew di `dt` secondi. */
export function slew(y: number, target: number, rise: number, fall: number, dt: number, linear: boolean): number {
  const time = target > y ? rise : fall;
  if (linear) {
    const step = dt / Math.max(1e-6, time);
    return target > y ? Math.min(target, y + step) : Math.max(target, y - step);
  }
  return y + (target - y) * (1 - Math.exp(-dt / Math.max(1e-6, time)));
}

export const lag: ModuleDefinition = {
  manifest: {
    id: 'lag',
    name: 'Lag',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'rise', label: 'Salita', min: 0.001, max: 10, default: 0.1, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'fall', label: 'Discesa', min: 0.001, max: 10, default: 0.1, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'shape', label: 'Forma', min: 0, max: 1, default: 0, kind: 'discrete', options: ['esponenziale', 'lineare'] },
    ],
    seeded: false,
  },
  create() {
    let y: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const n = input?.values.length ?? 1;
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          const target = input ? readVoice(input.values, v) : 0;
          y[v] = slew(y[v] ?? target, target, ctx.param('rise', v), ctx.param('fall', v), ctx.dt, ctx.discrete('shape', ctx.tick, v) === 1);
          out.values[v] = y[v]!;
        }
      },
      getState: () => [...y],
      setState(state) {
        y = [...(state as number[])];
      },
    };
  },
};

export default lag;
