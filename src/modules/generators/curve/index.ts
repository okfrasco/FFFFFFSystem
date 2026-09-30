/**
 * Curve — una forma disegnata letta dalla fase: `cycles` letture per ciclo
 * (sulla battuta: 1 = la curva dura una battuta). I punti si disegnano nel
 * nodo; `smooth` passa dai gradini (0) alla linea spezzata (1). L'uscita va
 * da `lo` a `hi`.
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export interface CurveConfig {
  points: number[];
}

/** La curva letta alla posizione u (0–1). */
export function readCurve(points: readonly number[], u: number, smooth: number): number {
  const n = points.length;
  if (n === 0) return 0;
  const x = (u - Math.floor(u)) * n;
  const i = Math.floor(x) % n;
  const a = points[i]!;
  const b = points[(i + 1) % n]!;
  return a + (b - a) * (x - Math.floor(x)) * smooth;
}

export const curve: ModuleDefinition = {
  manifest: {
    id: 'curve',
    name: 'Curve',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value', poly: true }],
    params: [
      { id: 'cycles', label: 'Cicli', min: 0.0625, max: 16, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'offset', label: 'Offset', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'smooth', label: 'Smussa', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'lo', label: 'Minimo', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: -1, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: { points: [0, 0.3, 0.8, 1, 0.6, 0.2, 0.5, 0.1] } satisfies CurveConfig,
  create(init) {
    let points = (init.config as CurveConfig).points;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const n = ph.end.length;
        const out = outputs.control('out', n);
        for (let v = 0; v < n; v++) {
          const u = readVoice(ph.end, v) * ctx.param('cycles', v) + ctx.param('offset', v);
          const y = readCurve(points, u, ctx.param('smooth', v));
          out.values[v] = ctx.param('lo', v) + (ctx.param('hi', v) - ctx.param('lo', v)) * y;
        }
      },
      setConfig(c) {
        points = (c as CurveConfig).points;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default curve;
