/**
 * Quantize a scalini — riduce un segnale continuo a `levels` gradini tra lo e
 * hi (per le altezze musicali c'è Quantize a scala, in Armonia). Un trigger a
 * ogni cambio di gradino, con il valore.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export function toSteps(x: number, levels: number, lo: number, hi: number): number {
  const n = Math.max(2, Math.round(levels));
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  if (b - a < 1e-9) return a;
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return a + (Math.round(u * (n - 1)) / (n - 1)) * (b - a);
}

export const quantizeSteps: ModuleDefinition = {
  manifest: {
    id: 'quantizeSteps',
    name: 'Quantize a scalini',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', poly: true }],
    outputs: [
      { id: 'out', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'levels', label: 'Gradini', min: 2, max: 64, default: 8, kind: 'discrete' },
      { id: 'lo', label: 'Minimo', min: -2, max: 2, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: -2, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let last: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const n = input?.values.length ?? 1;
        const out = outputs.control('out', n);
        const trig = outputs.control('trig', n);
        for (let v = 0; v < n; v++) {
          const y = toSteps(input ? readVoice(input.values, v) : 0, ctx.param('levels', v), ctx.param('lo', v), ctx.param('hi', v));
          if (last[v] !== undefined && y !== last[v]) trig.events.push({ kind: 'trig', t: ctx.t1, voice: v, vel: 1, value: y });
          last[v] = y;
          out.values[v] = y;
        }
      },
      getState: () => [...last],
      setState(state) {
        last = [...(state as number[])];
      },
    };
  },
};

export default quantizeSteps;
