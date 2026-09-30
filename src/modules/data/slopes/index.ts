/**
 * Slopes — segmenti disegnabili: punti liberi nel ciclo (x 0–1, y 0–1) uniti
 * da rampe, ognuna con la sua curvatura (−1 = parte veloce, 0 = dritta,
 * +1 = parte lenta). L'ultimo punto torna al primo nel ciclo dopo. Esce il
 * valore e un trigger a ogni punto attraversato (con l'indice del punto).
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

/** Un punto: [x, y, curvatura del segmento che parte da qui]. */
export type SlopePoint = [number, number, number];

export interface SlopesConfig {
  points: SlopePoint[];
}

/** Forma di un segmento: t 0–1, curvatura −1…1. */
export function shape(t: number, c: number): number {
  return Math.pow(Math.max(0, Math.min(1, t)), Math.pow(4, c));
}

/** Il valore delle rampe alla posizione u (cicli, anche fuori da 0–1). */
export function readSlopes(points: readonly SlopePoint[], u: number): number {
  const n = points.length;
  if (n === 0) return 0;
  if (n === 1) return points[0]![1];
  const x = u - Math.floor(u);
  // il segmento che contiene x: dall'ultimo punto con px ≤ x (o dall'ultimo, che scavalca il ciclo)
  let i = n - 1;
  for (let k = 0; k < n; k++) if (points[k]![0] <= x) i = k;
  const a = points[i]!;
  const b = points[(i + 1) % n]!;
  const ax = a[0];
  let bx = b[0];
  let px = x;
  if (i === n - 1 || bx <= ax) {
    bx += 1;
    if (px < ax) px += 1;
  }
  const t = bx > ax ? (px - ax) / (bx - ax) : 0;
  return a[1] + (b[1] - a[1]) * shape(t, a[2]);
}

export const slopes: ModuleDefinition = {
  manifest: {
    id: 'slopes',
    name: 'Slopes',
    category: 'data',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'out', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'cycles', label: 'Cicli', min: 0.0625, max: 16, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'offset', label: 'Offset', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'lo', label: 'Minimo', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'hi', label: 'Massimo', min: -1, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: {
    points: [
      [0, 0, 0.6],
      [0.25, 1, -0.5],
      [0.5, 0.35, 0],
      [0.625, 0.8, 0.8],
      [0.875, 0.1, 0],
    ],
  } satisfies SlopesConfig,
  create(init) {
    let points = [...(init.config as SlopesConfig).points].sort((p, q) => p[0] - q[0]);
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const voices = ph.end.length;
        const out = outputs.control('out', voices);
        const trig = outputs.control('trig', voices);
        for (let v = 0; v < voices; v++) {
          const cyc = ctx.param('cycles', v);
          const off = ctx.param('offset', v);
          const a = readVoice(ph.start, v) * cyc + off;
          const b = readVoice(ph.end, v) * cyc + off;
          const lo = ctx.param('lo', v);
          const hi = ctx.param('hi', v);
          // punti attraversati nel tick, in avanti [a, b) o all'indietro (b, a]
          if (a !== b) {
            points.forEach(([px], i) => {
              const fwd = b > a;
              let k = fwd ? Math.ceil(a - px) : Math.floor(a - px);
              for (;;) {
                const x = px + k;
                if (fwd ? x >= b : x <= b) break;
                if (fwd ? x >= a : x <= a) {
                  const t = ctx.t0 + ((x - a) / (b - a)) * (ctx.t1 - ctx.t0);
                  trig.events.push({ kind: 'trig', t, voice: v, vel: 1, value: i });
                }
                k += fwd ? 1 : -1;
              }
            });
          }
          out.values[v] = lo + (hi - lo) * readSlopes(points, b);
        }
        trig.events.sort((x, y) => x.t - y.t);
      },
      setConfig(c) {
        points = [...(c as SlopesConfig).points].sort((p, q) => p[0] - q[0]);
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default slopes;
