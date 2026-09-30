/**
 * Rhythm — un kit di batteria per genere (kick, snare, hat, perc), letto
 * dalla fase a sedicesimi (16 step per ciclo). Il genere è un parametro
 * discreto: modulabile e morphabile (step per step) come tutti.
 *
 *   density    0.5 = il genere com'è; meno toglie i colpi deboli, più ne aggiunge
 *   variation  0 = pattern canonico, 1 = ogni battuta si pesca dalle probabilità
 *   swing      si somma allo swing tipico del genere
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';
import { GENRES, GENRE_NAMES, INSTRUMENTS, decide, stepProb, velFor } from './genres';

export const rhythm: ModuleDefinition = {
  manifest: {
    id: 'rhythm',
    name: 'Rhythm',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: INSTRUMENTS.map((i) => ({ id: i, type: 'control' as const, signal: 'event' as const })),
    params: [
      { id: 'genre', label: 'Genere', min: 0, max: GENRES.length - 1, default: 0, kind: 'discrete', options: GENRE_NAMES },
      { id: 'density', label: 'Densità', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'variation', label: 'Variazione', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const outs = INSTRUMENTS.map((i) => outputs.control(i));
        const genre0 = GENRES[ctx.discrete('genre', Math.floor(ph.start[0]! * 16))] ?? GENRES[0]!;
        const swing = Math.max(-1, Math.min(1, ctx.param('swing') + genre0.swing));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, 16, ctx.t0, ctx.t1, swing)) {
          const genre = GENRES[ctx.discrete('genre', hit.step)] ?? GENRES[0]!;
          const i = mod(hit.step, 16);
          INSTRUMENTS.forEach((inst, k) => {
            const p = stepProb(genre.drums[inst][i]!, ctx.param('density'));
            if (decide(p, ctx.param('variation'), ctx.rng.float(), ctx.rng.float())) {
              outs[k]!.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: velFor(p), value: i });
            }
          });
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default rhythm;
