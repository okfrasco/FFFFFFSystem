/**
 * Griglia polimetrica — più corsie sotto lo stesso tempo, ognuna con la sua
 * lunghezza (step) e la sua suddivisione (step per beat): una corsia di 5
 * sedicesimi, una di 7 ottavi, una di 3 terzine… Collegare la fase dei beat
 * (Transport.beat). Uscite poly (voce i = corsia i): la fase di ogni corsia
 * (un ciclo = la sua lunghezza, per Steps, Gates, Euclideo poly) e un trigger
 * a ogni suo step, con l'indice.
 */

import { stepCrossings } from '../../../core/phase';
import type { ModuleDefinition, ParamSpec } from '../../../core/types';

const DEF: [number, number][] = [
  [16, 4],
  [5, 4],
  [7, 2],
  [3, 3],
  [9, 4],
  [4, 1],
];
const params: ParamSpec[] = [{ id: 'lanes', label: 'Corsie', min: 1, max: 6, default: 3, kind: 'discrete' }];
DEF.forEach(([len, div], i) => {
  params.push({ id: `len${i + 1}`, label: `lunghezza ${i + 1}`, min: 1, max: 32, default: len, kind: 'discrete' });
  params.push({ id: `div${i + 1}`, label: `step/beat ${i + 1}`, min: 1, max: 8, default: div, kind: 'discrete' });
});

export const polyGrid: ModuleDefinition = {
  manifest: {
    id: 'polyGrid',
    name: 'Griglia polimetrica',
    category: 'groove',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'phase', type: 'phase', poly: true },
      { id: 'step', type: 'control', signal: 'event', poly: true },
    ],
    params,
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const beat = inputs.phase('phase');
        if (!beat) return;
        const lanes = ctx.discrete('lanes', ctx.tick);
        const ph = outputs.phase('phase', lanes);
        const step = outputs.control('step', lanes);
        for (let i = 0; i < lanes; i++) {
          const len = ctx.discrete(`len${i + 1}`, ctx.tick);
          const div = ctx.discrete(`div${i + 1}`, ctx.tick);
          // un ciclo della corsia dura len/div beat
          const k = div / len;
          ph.start[i] = beat.start[0]! * k;
          ph.end[i] = beat.end[0]! * k;
          for (const hit of stepCrossings(ph.start[i]!, ph.end[i]!, len, ctx.t0, ctx.t1)) {
            step.events.push({ kind: 'trig', t: hit.t, voice: i, vel: hit.step % len === 0 ? 1 : 0.7, value: ((hit.step % len) + len) % len });
          }
        }
        step.events.sort((a, b) => a.t - b.t);
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default polyGrid;
