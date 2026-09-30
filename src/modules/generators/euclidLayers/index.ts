/**
 * Euclideo multistrato — un euclideo E(pulses, steps) con tre strati annidati:
 *
 *   accenti   E(accents, pulses) distribuito sui colpi principali: quali sono forti
 *   ghost     E(ghosts, steps − pulses) distribuito sui buchi: colpi deboli
 *   fill      nell'ultimo ciclo di ogni `fillEvery`, E(fillPulses, steps) si
 *             somma al pattern (i fill che arrivano a fine frase)
 *
 * Velocity: accento 1, normale `normal`, ghost e fill `ghost`. Uscite: tutti i
 * colpi, solo gli accenti, solo i ghost, e il gate. Polifonico come l'Euclideo.
 */

import { mod, stepCrossings } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';
import { bjorklund } from '../euclid';

export type LayerHit = 'accent' | 'normal' | 'ghost' | 'fill' | null;

/** Lo strato di uno step del ciclo (senza rotazione né mutazione). */
export function layerAt(i: number, steps: number, pulses: number, accents: number, ghosts: number, fill: boolean, fillPulses: number): LayerHit {
  const main = bjorklund(pulses, steps);
  if (main[i]) {
    const rank = main.slice(0, i).filter(Boolean).length; // quale colpo principale è
    return bjorklund(accents, Math.max(1, pulses))[rank] ? 'accent' : 'normal';
  }
  const holes = steps - main.filter(Boolean).length;
  const holeRank = main.slice(0, i).filter((x) => !x).length;
  if (holes > 0 && bjorklund(ghosts, holes)[holeRank]) return 'ghost';
  if (fill && bjorklund(fillPulses, steps)[i]) return 'fill';
  return null;
}

export const euclidLayers: ModuleDefinition = {
  manifest: {
    id: 'euclidLayers',
    name: 'Euclideo multistrato',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'accent', type: 'control', signal: 'event', poly: true },
      { id: 'ghost', type: 'control', signal: 'event', poly: true },
      { id: 'gate', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'steps', label: 'Step', min: 1, max: 32, default: 16, kind: 'discrete' },
      { id: 'pulses', label: 'Impulsi', min: 0, max: 32, default: 5, kind: 'discrete' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 31, default: 0, kind: 'discrete' },
      { id: 'accents', label: 'Accenti', min: 0, max: 32, default: 2, kind: 'discrete' },
      { id: 'ghosts', label: 'Ghost', min: 0, max: 32, default: 3, kind: 'discrete' },
      { id: 'fillEvery', label: 'Fill ogni', min: 0, max: 16, default: 4, kind: 'discrete', unit: 'cicli' },
      { id: 'fillPulses', label: 'Colpi fill', min: 0, max: 32, default: 7, kind: 'discrete' },
      { id: 'normal', label: 'Vel. normale', min: 0, max: 1, default: 0.7, kind: 'continuous' },
      { id: 'ghostVel', label: 'Vel. ghost', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },
  create() {
    let level: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const voices = ph.end.length;
        const trig = outputs.control('trig', voices);
        const accent = outputs.control('accent', voices);
        const ghost = outputs.control('ghost', voices);
        const gate = outputs.control('gate', voices);
        for (let v = 0; v < voices; v++) {
          const a = ph.start[v]!;
          const steps = ctx.discrete('steps', Math.floor(a), v);
          for (const hit of stepCrossings(a, ph.end[v]!, steps, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const k = hit.step;
            const cycle = Math.floor(k / steps);
            const every = ctx.discrete('fillEvery', cycle, v);
            const fill = every > 0 && mod(cycle, every) === every - 1;
            const i = mod(k - ctx.discrete('rotate', k, v), steps);
            const pulses = Math.min(steps, ctx.discrete('pulses', k, v));
            let layer = layerAt(i, steps, pulses, Math.min(pulses, ctx.discrete('accents', k, v)), ctx.discrete('ghosts', k, v), fill, ctx.discrete('fillPulses', k, v));
            if (ctx.rng.chance(ctx.param('mutation', v) * 0.3)) layer = layer ? null : 'ghost';
            level[v] = layer ? 1 : 0;
            if (!layer) continue;
            const vel = layer === 'accent' ? 1 : layer === 'normal' ? ctx.param('normal', v) : ctx.param('ghostVel', v);
            const ev = { kind: 'trig' as const, t: hit.t, voice: v, vel, value: layer === 'accent' ? 2 : layer === 'normal' ? 1 : 0 };
            trig.events.push(ev);
            if (layer === 'accent') accent.events.push({ ...ev });
            if (layer === 'ghost' || layer === 'fill') ghost.events.push({ ...ev });
          }
          gate.values[v] = level[v] ?? 0;
          trig.values[v] = level[v] ?? 0;
        }
      },
      getState: () => [...level],
      setState(state) {
        level = [...(state as number[])];
      },
    };
  },
};

export default euclidLayers;
