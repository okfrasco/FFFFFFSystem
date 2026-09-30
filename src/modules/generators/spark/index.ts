/**
 * Spark — trigger casuali con un solo knob: `spark` sceglie insieme la
 * divisione (da 1 a 64 step per ciclo, raddoppiando) e la probabilità di
 * scattare. Girando il knob si passa da colpi rari e lunghi a raffiche fitte.
 */

import { stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

/** Divisione e probabilità per un valore del knob (0–1). */
export function sparkMap(spark: number): { division: number; prob: number } {
  const x = Math.max(0, Math.min(1, spark)) * 6.999;
  const i = Math.floor(x);
  return { division: Math.pow(2, i), prob: 0.2 + 0.8 * (x - i) };
}

export const spark: ModuleDefinition = {
  manifest: {
    id: 'spark',
    name: 'Spark',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'spark', label: 'Spark', min: 0, max: 1, default: 0.55, kind: 'continuous' },
      { id: 'velocity', label: 'Velocity casuale', min: 0, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const out = outputs.control('trig');
        const { division, prob } = sparkMap(ctx.param('spark'));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, division, ctx.t0, ctx.t1)) {
          if (!ctx.rng.chance(prob)) continue;
          out.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1 - ctx.param('velocity') * ctx.rng.float() });
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default spark;
