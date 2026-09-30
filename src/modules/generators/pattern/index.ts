/**
 * Pattern — linee per genere, per basso o lead: la linea tipica del genere in
 * gradi di scala, letta a sedicesimi. Escono trigger con il grado come valore
 * (verso Quantize in modo grado, poi Voci). Con `variation` alcune note
 * saltano o scivolano sul grado vicino; `octave` sposta ogni tanto
 * all'ottava sopra (+7 gradi) per i bassi che saltano.
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';
import { GENRES, GENRE_NAMES } from '../rhythm/genres';

export const pattern: ModuleDefinition = {
  manifest: {
    id: 'pattern',
    name: 'Pattern',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'genre', label: 'Genere', min: 0, max: GENRES.length - 1, default: 0, kind: 'discrete', options: GENRE_NAMES },
      { id: 'role', label: 'Ruolo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['basso', 'lead'] },
      { id: 'variation', label: 'Variazione', min: 0, max: 1, default: 0.2, kind: 'continuous' },
      { id: 'octave', label: 'Salti d\'ottava', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -7, max: 7, default: 0, kind: 'discrete', unit: 'gradi' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const out = outputs.control('trig');
        const g0 = GENRES[ctx.discrete('genre', Math.floor(ph.start[0]! * 16))] ?? GENRES[0]!;
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, 16, ctx.t0, ctx.t1, Math.max(-1, Math.min(1, ctx.param('swing') + g0.swing)))) {
          const genre = GENRES[ctx.discrete('genre', hit.step)] ?? GENRES[0]!;
          const line = ctx.discrete('role', hit.step) === 1 ? genre.lead : genre.bass;
          let deg = line[mod(hit.step, 16)];
          const v = ctx.param('variation');
          if (deg === null || deg === undefined) continue;
          if (ctx.rng.chance(v * 0.3)) continue; // una nota salta
          if (ctx.rng.chance(v * 0.4)) deg += ctx.rng.chance(0.5) ? 1 : -1;
          if (ctx.rng.chance(ctx.param('octave'))) deg += 7;
          out.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: mod(hit.step, 4) === 0 ? 1 : 0.8, value: deg + ctx.discrete('transpose', hit.step) });
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default pattern;
