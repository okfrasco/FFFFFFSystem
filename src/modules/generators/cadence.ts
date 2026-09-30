/**
 * Cadenza — generatore ritmico e melodico a conteggio.
 *
 *   multiple    unità di misura, in sedicesimi (1 = sedicesimo, 2 = ottavo, 3 = ottavo puntato…)
 *   bar length  quante unità formano una battuta
 *   size        = multiple × bar length: la lunghezza totale in sedicesimi
 *   cadence     un colpo ogni N sedicesimi; il conteggio riparte alla fine della size
 *
 * Esempio: multiple 3, bar length 5 → size 15; cadence 4 → colpi agli step
 * 0, 4, 8, 12, poi di nuovo da 0 (15 contro il 16 della battuta: polimetro).
 *
 * A ogni colpo emette una nota con pitch, length (in step) e velocity letti in
 * quell'istante: un cavo di modulazione (es. un LFO aliasato) li cambia colpo
 * per colpo. Gli step sono sedicesimi se la fase in ingresso è la battuta
 * (`division` = 16 step per ciclo).
 * Mutazione: probabilità che un colpo salti o che uno step fuori cadenza suoni.
 */

import { mod, stepCrossings } from '../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../core/types';

interface CadenceState {
  pos: number;
}

/** Size in sedicesimi e posizione dei colpi dentro la size (per test e widget). */
export function cadenceHits(multiple: number, barLength: number, cadence: number, offset = 0): { size: number; hits: number[] } {
  const size = Math.max(1, multiple * barLength);
  const hits: number[] = [];
  for (let p = 0; p < size; p++) if (mod(p - offset, size) % Math.max(1, cadence) === 0) hits.push(p);
  return { size, hits };
}

export const cadence: ModuleDefinition = {
  manifest: {
    id: 'cadence',
    name: 'Cadenza',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'note', type: 'control', signal: 'event' },
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'pos', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'multiple', label: 'Multiple', min: 1, max: 16, default: 1, kind: 'discrete' },
      { id: 'barLength', label: 'Bar length', min: 1, max: 32, default: 16, kind: 'discrete' },
      { id: 'cadence', label: 'Cadence', min: 1, max: 64, default: 3, kind: 'discrete' },
      { id: 'offset', label: 'Offset', min: 0, max: 63, default: 0, kind: 'discrete' },
      { id: 'pitch', label: 'Pitch', min: 24, max: 96, default: 60, kind: 'continuous' },
      { id: 'length', label: 'Length', min: 0.1, max: 16, default: 1, kind: 'continuous', curve: 'exp', unit: 'step' },
      { id: 'velocity', label: 'Velocity', min: 0, max: 1, default: 0.8, kind: 'continuous' },
      { id: 'division', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },

  create() {
    let s: CadenceState = { pos: 0 };
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const a = ph.start[0]!;
        const b = ph.end[0]!;
        const division = ctx.discrete('division', Math.floor(a));
        const note = outputs.control('note');
        const trig = outputs.control('trig');
        // durata di uno step in secondi, dalla velocità della fase
        const stepDur = b !== a ? Math.abs((ctx.t1 - ctx.t0) / ((b - a) * division)) : 0;
        for (const hit of stepCrossings(a, b, division, ctx.t0, ctx.t1, ctx.param('swing'))) {
          const k = hit.step;
          const size = Math.max(1, ctx.discrete('multiple', k) * ctx.discrete('barLength', k));
          const p = mod(k, size);
          s.pos = p / size;
          const cad = ctx.discrete('cadence', k);
          let on = mod(p - ctx.discrete('offset', k), size) % cad === 0;
          const m = ctx.param('mutation');
          if (m > 0 && ctx.rng.chance(m * (on ? 0.3 : 0.1))) on = !on;
          if (!on) continue;
          const pitch = ctx.param('pitch');
          const vel = ctx.param('velocity');
          note.events.push({ kind: 'note', t: hit.t, voice: 0, pitch, vel, dur: ctx.param('length') * stepDur });
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel, value: pitch });
        }
        outputs.control('pos').values[0] = s.pos;
        trig.values[0] = 1;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as CadenceState) };
      },
    };
  },
};
