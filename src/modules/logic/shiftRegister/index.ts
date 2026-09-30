/**
 * Shift Register — memoria seriale: a ogni colpo del clock il valore in
 * ingresso entra nella prima cella e tutte le altre scorrono di una.
 * L'uscita è poly: la voce i è la cella i (la voce 0 è il valore appena
 * entrato, la 1 quello di un colpo fa…). Un trigger per voce a ogni colpo,
 * con il suo valore: canoni di valori (verso Quantize poly → Voci).
 */

import { eventsOf, isOn, readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

export const shiftRegister: ModuleDefinition = {
  manifest: {
    id: 'shiftRegister',
    name: 'Shift Register',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control' },
      { id: 'clock', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [{ id: 'length', label: 'Celle', min: 1, max: 16, default: 4, kind: 'discrete' }],
    seeded: false,
  },
  create() {
    let cells: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const N = ctx.discrete('length', ctx.tick);
        const out = outputs.control('out', N);
        const trig = outputs.control('trig', N);
        const input = inputs.control('in');
        for (const e of eventsOf(inputs.control('clock'), 0).filter(isOn)) {
          // il valore del colpo, se lo porta, altrimenti quello dell'ingresso
          const x = e.kind === 'trig' && e.value !== undefined ? e.value : input ? readVoice(input.values, 0) : 0;
          cells = [x, ...cells].slice(0, N);
          for (let i = 0; i < cells.length; i++) trig.events.push({ kind: 'trig', t: e.t, voice: i, vel: e.kind === 'gate' ? 1 : e.vel, value: cells[i]! });
        }
        for (let i = 0; i < N; i++) out.values[i] = cells[i] ?? 0;
      },
      getState: () => [...cells],
      setState(state) {
        cells = [...(state as number[])];
      },
    };
  },
};

export default shiftRegister;
