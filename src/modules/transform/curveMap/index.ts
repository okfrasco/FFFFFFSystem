/**
 * Curve map — rimappa l'ingresso con una curva disegnata: l'ingresso (tra
 * `inLo` e `inHi`) sceglie il punto della curva, l'uscita è il suo valore.
 * Per dare una forma alle modulazioni (esponenziali, a S, a gradini…).
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export interface CurveMapConfig {
  points: number[];
}

/** Valore della curva in x (0–1), interpolato tra i punti (estremi compresi). */
export function mapCurve(points: readonly number[], x: number): number {
  const n = points.length;
  if (n === 0) return 0;
  if (n === 1) return points[0]!;
  const u = Math.max(0, Math.min(1, x)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(u));
  return points[i]! + (points[i + 1]! - points[i]!) * (u - i);
}

export const curveMap: ModuleDefinition = {
  manifest: {
    id: 'curveMap',
    name: 'Curve map',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'inLo', label: 'Ingresso min', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'inHi', label: 'Ingresso max', min: 0, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: { points: [0, 0.02, 0.06, 0.12, 0.2, 0.32, 0.48, 0.7, 1] } satisfies CurveMapConfig,
  create(init) {
    let points = (init.config as CurveMapConfig).points;
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const n = input?.values.length ?? 1;
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          const lo = ctx.param('inLo', v);
          const hi = ctx.param('inHi', v);
          const x = input ? readVoice(input.values, v) : 0;
          out.values[v] = mapCurve(points, (x - lo) / Math.max(1e-6, hi - lo));
        }
      },
      setConfig(c) {
        points = (c as CurveMapConfig).points;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default curveMap;
