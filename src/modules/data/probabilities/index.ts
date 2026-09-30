/**
 * Probabilities — probabilità di scatto per step, letta dalla fase. Due usi:
 *   - senza ingresso `in`: ogni step scatta con la sua probabilità;
 *   - con `in` collegato: filtra gli eventi in arrivo, ognuno con la
 *     probabilità dello step in cui cade (un Euclideo che "respira").
 * `bias` sposta tutte le probabilità insieme (−1 = mai, +1 = sempre).
 */

import { mod, phaseAt, stepCrossings } from '../../../core/phase';
import { isOn } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export interface ProbabilitiesConfig {
  probs: number[];
}

export const probabilities: ModuleDefinition = {
  manifest: {
    id: 'probabilities',
    name: 'Probabilities',
    category: 'data',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'in', type: 'control', signal: 'event', poly: true },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'prob', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'bias', label: 'Bias', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  defaultConfig: { probs: [1, 0.2, 0.5, 0.2, 0.9, 0.2, 0.6, 0.35, 1, 0.15, 0.5, 0.25, 0.8, 0.3, 0.7, 0.45] } satisfies ProbabilitiesConfig,

  create(init) {
    let probs = (init.config as ProbabilitiesConfig).probs;
    const probOf = (step: number, rotate: number, bias: number) => Math.max(0, Math.min(1, (probs[mod(step - rotate, probs.length)] ?? 0) + bias));
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        const input = inputs.control('in');
        const n = probs.length;
        if (!ph || n === 0) return;
        const trig = outputs.control('trig', input?.values.length ?? 1);
        const rotate = ctx.discrete('rotate', Math.floor(ph.start[0]!));
        const bias = ctx.param('bias');
        if (input) {
          for (const e of input.events) {
            // le chiusure di gate passano sempre: si scarta solo chi apre
            if (!isOn(e)) {
              trig.events.push(e);
              continue;
            }
            const step = Math.floor(phaseAt(ph.start[0]!, ph.end[0]!, ctx.t0, ctx.t1, e.t) * n + 1e-9);
            if (ctx.rng.chance(probOf(step, rotate, bias))) trig.events.push(e);
          }
        } else {
          for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, n, ctx.t0, ctx.t1, ctx.param('swing'))) {
            if (ctx.rng.chance(probOf(hit.step, rotate, bias))) trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1, value: mod(hit.step, n) });
          }
        }
        outputs.control('prob').values[0] = probOf(Math.floor(ph.end[0]! * n), rotate, bias);
      },
      setConfig(config) {
        probs = (config as ProbabilitiesConfig).probs;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default probabilities;
