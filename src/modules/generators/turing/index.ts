/**
 * Turing Machine — il loop che muta (alla Music Thing Modular): un registro
 * a scorrimento di `length` bit. A ogni step il bit che esce rientra
 * dall'altra parte, e con probabilità `change` viene invertito:
 *
 *   change 0     il loop è bloccato: ripete gli stessi `length` step
 *   change 0.5   ogni step è nuovo
 *   change 1     il loop si inverte a ogni giro (si ripete ogni 2·length)
 *
 * Il valore sono i primi 8 bit letti come numero (0–1): una melodia che si
 * ripete e ogni tanto cambia. Trigger e gate quando il primo bit è 1.
 * Clock: ingresso trig, oppure la fase con `steps` step per ciclo.
 */

import { clockHits } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

interface TuringState {
  bits: number[];
  counter: number;
  flipped: number;
}

/** Il valore dei primi 8 bit (il primo è il più significativo), 0–1. */
export function registerValue(bits: readonly number[]): number {
  let v = 0;
  for (let i = 0; i < 8; i++) v = v * 2 + (bits[i % bits.length] ?? 0);
  return v / 255;
}

export const turing: ModuleDefinition = {
  manifest: {
    id: 'turing',
    name: 'Turing Machine',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'gate', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'length', label: 'Lunghezza', min: 2, max: 16, default: 8, kind: 'discrete' },
      { id: 'change', label: 'Change', min: 0, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    let s: TuringState | null = null;
    return {
      process(ctx, inputs, outputs) {
        // registro iniziale casuale, dal seed
        s ??= { bits: Array.from({ length: 16 }, () => (ctx.rng.chance(0.5) ? 1 : 0)), counter: 0, flipped: -1 };
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          const len = ctx.discrete('length', hit.key);
          const loop = s.bits.slice(0, len);
          let bit = loop[len - 1]!;
          s.flipped = -1;
          if (ctx.rng.chance(ctx.param('change'))) {
            bit = 1 - bit;
            s.flipped = 0;
          }
          s.bits = [bit, ...loop.slice(0, len - 1), ...s.bits.slice(len)];
          if (bit === 1) trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: registerValue(s.bits.slice(0, len)) });
        }
        const len = ctx.discrete('length', s.counter);
        outputs.control('out').values[0] = registerValue(s.bits.slice(0, len));
        outputs.control('gate').values[0] = s.bits[0]!;
        trig.values[0] = s.bits[0]!;
      },
      getState: () => (s ? { bits: [...s.bits], counter: s.counter, flipped: s.flipped } : null),
      setState(state) {
        const st = state as TuringState | null;
        s = st ? { bits: [...st.bits], counter: st.counter, flipped: st.flipped } : null;
      },
    };
  },
};

export default turing;
