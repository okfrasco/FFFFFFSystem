/**
 * Style Blend — miscela di due grammatiche di genere: le probabilità di A e B
 * si interpolano con `blend` (0.3 = 70% A, 30% B), e da lì si decide colpo
 * per colpo come in Rhythm. Con variazione alta la miscela si sente come
 * "a volte l'uno, a volte l'altro"; con variazione bassa come un terzo
 * pattern canonico a metà strada.
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';
import { GENRES, GENRE_NAMES, INSTRUMENTS, decide, stepProb, velFor } from '../rhythm/genres';

export const blendProb = (a: number, b: number, blend: number): number => a + (b - a) * blend;

export const styleBlend: ModuleDefinition = {
  manifest: {
    id: 'styleBlend',
    name: 'Style Blend',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: INSTRUMENTS.map((i) => ({ id: i, type: 'control' as const, signal: 'event' as const })),
    params: [
      { id: 'a', label: 'Genere A', min: 0, max: GENRES.length - 1, default: 2, kind: 'discrete', options: GENRE_NAMES },
      { id: 'b', label: 'Genere B', min: 0, max: GENRES.length - 1, default: 5, kind: 'discrete', options: GENRE_NAMES },
      { id: 'blend', label: 'Miscela', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'density', label: 'Densità', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'variation', label: 'Variazione', min: 0, max: 1, default: 0.6, kind: 'continuous' },
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
        const blend = ctx.param('blend');
        const k0 = Math.floor(ph.start[0]! * 16);
        const A0 = GENRES[ctx.discrete('a', k0)] ?? GENRES[0]!;
        const B0 = GENRES[ctx.discrete('b', k0)] ?? GENRES[0]!;
        const swing = Math.max(-1, Math.min(1, ctx.param('swing') + blendProb(A0.swing, B0.swing, blend)));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, 16, ctx.t0, ctx.t1, swing)) {
          const A = GENRES[ctx.discrete('a', hit.step)] ?? GENRES[0]!;
          const B = GENRES[ctx.discrete('b', hit.step)] ?? GENRES[0]!;
          const i = mod(hit.step, 16);
          INSTRUMENTS.forEach((inst, k) => {
            const p = stepProb(blendProb(A.drums[inst][i]!, B.drums[inst][i]!, blend), ctx.param('density'));
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

export default styleBlend;
