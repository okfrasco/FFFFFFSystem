/**
 * Sample & Hold — congela il valore dell'ingresso a ogni trigger.
 * Modo "segui": finché il gate è alto l'uscita segue l'ingresso, quando
 * scende resta ferma (track & hold). Un trigger in uscita a ogni campione.
 * Il valore preso è quello dell'ingresso a fine tick (entro 5 ms dal trigger).
 */

import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export const sampleHold: ModuleDefinition = {
  manifest: {
    id: 'sampleHold',
    name: 'Sample & Hold',
    category: 'transform',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', poly: true },
      { id: 'trig', type: 'control', poly: true },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [{ id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['campiona', 'segui'] }],
    seeded: false,
  },
  create() {
    let held: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const trigIn = inputs.control('trig');
        const n = Math.max(input?.values.length ?? 1, trigIn?.values.length ?? 1);
        const out = outputs.control('out', n);
        const trig = outputs.control('trig', n);
        for (let v = 0; v < n; v++) {
          const x = input ? readVoice(input.values, v) : 0;
          if (ctx.discrete('mode', ctx.tick, v) === 1) {
            if (trigIn && readVoice(trigIn.values, v) >= 0.5) held[v] = x;
          }
          const tn = trigIn?.values.length ?? 1;
          for (const e of trigIn?.events ?? []) {
            if ((tn > 1 && e.voice % tn !== v % tn) || (e.kind === 'gate' && !e.on)) continue;
            held[v] = x;
            trig.events.push({ kind: 'trig', t: e.t, voice: v, vel: e.kind === 'gate' ? 1 : e.vel, value: x });
          }
          out.values[v] = held[v] ?? 0;
        }
      },
      getState: () => [...held],
      setState(state) {
        held = [...(state as number[])];
      },
    };
  },
};

export default sampleHold;
