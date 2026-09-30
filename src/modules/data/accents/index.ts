/**
 * Accents — tre stati per step, letti dalla fase: 0 pausa, 1 colpo normale,
 * 2 accento. Il trigger porta la velocity del suo stato e lo stato come valore;
 * `accent` scatta solo sugli accenti (per aprire un filtro, alzare un drive).
 *
 * Mutazione: probabilità che uno step suoni con un altro stato.
 */

import { mod, stepCrossings } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';

export interface AccentsConfig {
  cells: number[];
}

interface AccentsState {
  level: number[];
}

export const accents: ModuleDefinition = {
  manifest: {
    id: 'accents',
    name: 'Accents',
    category: 'data',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'accent', type: 'control', signal: 'event', poly: true },
      { id: 'level', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'normal', label: 'Vel. normale', min: 0.05, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'strong', label: 'Vel. accento', min: 0.05, max: 1, default: 1, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },
  defaultConfig: { cells: [2, 0, 1, 0, 1, 0, 1, 1, 2, 0, 1, 0, 1, 1, 0, 1] } satisfies AccentsConfig,

  create(init) {
    let cells = (init.config as AccentsConfig).cells;
    let s: AccentsState = { level: [] };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph || cells.length === 0) return;
        const voices = ph.end.length;
        const trig = outputs.control('trig', voices);
        const accent = outputs.control('accent', voices);
        const level = outputs.control('level', voices);
        for (let v = 0; v < voices; v++) {
          for (const hit of stepCrossings(ph.start[v]!, ph.end[v]!, cells.length, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const idx = mod(hit.step - ctx.discrete('rotate', hit.step, v), cells.length);
            let st = cells[idx] ?? 0;
            if (ctx.rng.chance(ctx.param('mutation', v))) st = (st + 1 + ctx.rng.int(0, 2)) % 3;
            s.level[v] = st / 2;
            if (st === 0) continue;
            const vel = ctx.param(st === 2 ? 'strong' : 'normal', v);
            trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel, value: st });
            if (st === 2) accent.events.push({ kind: 'trig', t: hit.t, voice: v, vel });
          }
          level.values[v] = s.level[v] ?? 0;
        }
      },
      setConfig(config) {
        cells = (config as AccentsConfig).cells;
      },
      getState: () => ({ level: [...s.level] }),
      setState(state) {
        s = { level: [...(state as AccentsState).level] };
      },
    };
  },
};

export default accents;
