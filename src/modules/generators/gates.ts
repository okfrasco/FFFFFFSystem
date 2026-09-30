/**
 * Gates — sequenza di gate letta dalla fase: la tabella intera copre un ciclo.
 * Ogni valore è la velocity dello step (0 = pausa), quindi la stessa tabella
 * fa anche da accenti. Per step più corti o più lunghi si piega la fase
 * (Ø Scale), non la tabella.
 *
 * Mutazione: probabilità di invertire uno step (ghost a velocity 0.5 o pausa).
 */

import { mod, stepCrossings } from '../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../core/types';

export interface GatesConfig {
  gates: number[];
}

interface GatesState {
  level: number[];
}

export const gates: ModuleDefinition = {
  manifest: {
    id: 'gates',
    name: 'Gates',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'gate', type: 'control', signal: 'value', poly: true },
    ],
    params: [{ id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' }, ...STANDARD_GENERATOR_PARAMS],
    seeded: true,
  },
  defaultConfig: { gates: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] } satisfies GatesConfig,

  create(init) {
    let table = (init.config as GatesConfig).gates;
    let s: GatesState = { level: [] };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph || table.length === 0) return;
        const voices = ph.end.length;
        const trig = outputs.control('trig', voices);
        const gate = outputs.control('gate', voices);
        for (let v = 0; v < voices; v++) {
          for (const hit of stepCrossings(ph.start[v]!, ph.end[v]!, table.length, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const idx = mod(hit.step - ctx.discrete('rotate', hit.step, v), table.length);
            let vel = table[idx] ?? 0;
            if (ctx.rng.chance(ctx.param('mutation', v) * 0.5)) vel = vel > 0 ? 0 : 0.5;
            s.level[v] = vel > 0 ? 1 : 0;
            if (vel > 0) trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel });
          }
          trig.values[v] = s.level[v] ?? 0;
          gate.values[v] = s.level[v] ?? 0;
        }
      },
      setConfig(config) {
        table = (config as GatesConfig).gates;
      },
      getState: () => ({ level: [...s.level] }),
      setState(state) {
        s = { level: [...(state as GatesState).level] };
      },
    };
  },
};
