/**
 * Steps — sequenza di valori letta dalla fase: la tabella intera copre un
 * ciclo. Uscita `value` tenuta per tutto lo step, e un trigger all'inizio di
 * ogni step che porta lo stesso valore (per Quantize o Memoria).
 *
 * Mutazione: probabilità che uno step suoni un altro valore della tabella.
 */

import { mod, stepCrossings } from '../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../core/types';

export interface StepsConfig {
  values: number[];
}

interface StepsState {
  value: number[];
}

export const steps: ModuleDefinition = {
  manifest: {
    id: 'steps',
    name: 'Steps',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'value', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [{ id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' }, ...STANDARD_GENERATOR_PARAMS],
    seeded: true,
  },
  defaultConfig: { values: [0, 2, 4, 7] } satisfies StepsConfig,

  create(init) {
    let table = (init.config as StepsConfig).values;
    let s: StepsState = { value: [] };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph || table.length === 0) return;
        const voices = ph.end.length;
        const value = outputs.control('value', voices);
        const trig = outputs.control('trig', voices);
        for (let v = 0; v < voices; v++) {
          for (const hit of stepCrossings(ph.start[v]!, ph.end[v]!, table.length, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const idx = mod(hit.step - ctx.discrete('rotate', hit.step, v), table.length);
            let x = table[idx] ?? 0;
            if (ctx.rng.chance(ctx.param('mutation', v))) x = ctx.rng.pick(table);
            s.value[v] = x;
            trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel: 1, value: x });
          }
          value.values[v] = s.value[v] ?? 0;
          trig.values[v] = s.value[v] === undefined ? 0 : 1; // livello: acceso dal primo step
        }
      },
      setConfig(config) {
        table = (config as StepsConfig).values;
      },
      getState: () => ({ value: [...s.value] }),
      setState(state) {
        s = { value: [...(state as StepsState).value] };
      },
    };
  },
};
