/**
 * Cicli — fino a 6 corsie, ognuna con un colpo ogni L_i step (a `division`
 * step per ciclo della fase). Con lunghezze prime tra loro (3, 5, 7, 11…) le
 * corsie si riallineano raramente: il minimo comune multiplo di 3·5·7·11 è
 * 1155 step. `align` scatta quando tutte colpiscono insieme.
 * Uscita poly: la voce i è la corsia i.
 */

import { stepCrossings } from '../../../core/phase';
import type { ModuleDefinition, ParamSpec } from '../../../core/types';

const DEFAULT_LENGTHS = [3, 5, 7, 11, 13, 4];
const params: ParamSpec[] = [
  { id: 'lanes', label: 'Corsie', min: 1, max: 6, default: 4, kind: 'discrete' },
  { id: 'division', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
];
DEFAULT_LENGTHS.forEach((l, i) => params.push({ id: `len${i + 1}`, label: `lunghezza ${i + 1}`, min: 1, max: 32, default: l, kind: 'discrete' }));

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
/** Ogni quanti step si riallineano tutte le corsie. */
export const realign = (lengths: number[]): number => lengths.reduce((m, l) => (m * l) / gcd(m, l), 1);

export const cycles: ModuleDefinition = {
  manifest: {
    id: 'cycles',
    name: 'Cicli',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'align', type: 'control', signal: 'event' },
    ],
    params,
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const lanes = ctx.discrete('lanes', ctx.tick);
        const trig = outputs.control('trig', lanes);
        const align = outputs.control('align');
        const div = ctx.discrete('division', Math.floor(ph.start[0]!));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, div, ctx.t0, ctx.t1)) {
          let all = true;
          for (let i = 0; i < lanes; i++) {
            const L = ctx.discrete(`len${i + 1}`, hit.step);
            const on = ((hit.step % L) + L) % L === 0;
            if (on) trig.events.push({ kind: 'trig', t: hit.t, voice: i, vel: 1, value: i });
            all &&= on;
          }
          if (all) align.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1 });
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default cycles;
