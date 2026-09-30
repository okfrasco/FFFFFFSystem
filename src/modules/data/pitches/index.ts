/**
 * Pitches — sequenza di note letta dalla fase (−1 = pausa). Esce una nota con
 * durata (`length` in step: 1 = legato fino allo step dopo), l'altezza tenuta
 * come valore e un trigger per step suonato.
 *
 * Mutazione: probabilità che uno step suoni un'altra nota della sequenza o la
 * stessa un'ottava sopra.
 */

import { mod, stepCrossings } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';

export interface PitchesConfig {
  notes: number[];
  /** Nota più bassa mostrata nell'editor (solo interfaccia). */
  low?: number;
}

interface PitchesState {
  pitch: number[];
}

export const pitches: ModuleDefinition = {
  manifest: {
    id: 'pitches',
    name: 'Pitches',
    category: 'data',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'pitch', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'transpose', label: 'Trasponi', min: -24, max: 24, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'length', label: 'Durata', min: 0.05, max: 4, default: 0.8, kind: 'continuous', curve: 'exp', unit: 'step' },
      { id: 'vel', label: 'Velocity', min: 0.05, max: 1, default: 0.8, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },
  defaultConfig: { notes: [48, 55, 60, -1, 63, 60, 55, 58], low: 43 } satisfies PitchesConfig,

  create(init) {
    let notes = (init.config as PitchesConfig).notes;
    let s: PitchesState = { pitch: [] };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        const n = notes.length;
        if (!ph || n === 0) return;
        const voices = ph.end.length;
        const note = outputs.control('note', voices);
        const pitch = outputs.control('pitch', voices);
        for (let v = 0; v < voices; v++) {
          const speed = Math.abs(ph.end[v]! - ph.start[v]!) / Math.max(1e-9, ctx.dt);
          const stepDur = speed > 0 ? 1 / (speed * n) : 0.25;
          for (const hit of stepCrossings(ph.start[v]!, ph.end[v]!, n, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            let p = notes[mod(hit.step - ctx.discrete('rotate', hit.step, v), n)] ?? -1;
            if (p >= 0 && ctx.rng.chance(ctx.param('mutation', v))) {
              const others = notes.filter((x) => x >= 0);
              p = ctx.rng.chance(0.5) ? p + 12 : ctx.rng.pick(others);
            }
            if (p < 0) continue;
            p += ctx.discrete('transpose', hit.step, v);
            s.pitch[v] = p;
            note.events.push({ kind: 'note', t: hit.t, voice: v, pitch: p, vel: ctx.param('vel', v), dur: ctx.param('length', v) * stepDur });
          }
          pitch.values[v] = s.pitch[v] ?? 0;
        }
      },
      setConfig(config) {
        notes = (config as PitchesConfig).notes;
      },
      getState: () => ({ pitch: [...s.pitch] }),
      setState(state) {
        s = { pitch: [...(state as PitchesState).pitch] };
      },
    };
  },
};

export default pitches;
