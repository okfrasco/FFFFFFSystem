/**
 * Array — una tabella di `size` celle che si registra al volo da qualunque
 * segnale e si rilegge con la fase. Mentre registra (`record` acceso o
 * ingresso `rec` alto) scrive nella cella sotto la fase:
 *   - se `in` porta eventi, il valore di ogni evento (trigger con valore,
 *     altezza delle note, velocity) nella cella in cui cade;
 *   - altrimenti il valore continuo di `in`, tick per tick.
 * `clear` azzera la tabella. La tabella è stato del nodo: le scene la
 * catturano, il morph la cambia a metà strada.
 */

import { mod, phaseAt, stepCrossings } from '../../../core/phase';
import { isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export interface ArrayState {
  table: number[];
}

const MAX = 256;

/** Il valore che un evento scrive nella tabella. */
export function eventValue(e: ControlEvent): number {
  if (e.kind === 'note') return e.pitch;
  if (e.kind === 'trig') return e.value ?? e.vel;
  return e.on ? 1 : 0;
}

export const array: ModuleDefinition = {
  manifest: {
    id: 'array',
    name: 'Array',
    category: 'data',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'in', type: 'control' },
      { id: 'rec', type: 'control' },
      { id: 'clear', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'out', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'size', label: 'Celle', min: 1, max: MAX, default: 16, kind: 'discrete' },
      { id: 'record', label: 'Registra', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'smooth', label: 'Smussa', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: ArrayState = { table: [] };
    let recLevel = 0;
    // un ingresso che ha portato eventi non si legge più come valore (il suo livello è quello del trigger)
    let eventful = false;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        const input = inputs.control('in');
        const size = ctx.discrete('size', ctx.tick);
        const table = s.table;
        while (table.length < size) table.push(0);
        if (table.length > size) table.length = size;
        for (const e of inputs.control('clear')?.events ?? []) if (isOn(e)) table.fill(0);
        if (!ph) return;
        const start = ph.start[0]!;
        const end = ph.end[0]!;
        const cell = (p: number) => mod(Math.floor(p * size + 1e-9), size);

        // registrazione: il livello di rec si aggiorna evento per evento
        const recIn = inputs.control('rec');
        const recParam = ctx.param('record') >= 0.5;
        let recording = recParam || recLevel > 0.5;
        const recEvents = recIn?.events ?? [];
        if (recIn && recEvents.length === 0) recLevel = recIn.values[0]!;
        const events = input?.events ?? [];
        if (events.length > 0) eventful = true;
        if (eventful) {
          let r = 0;
          for (const e of events) {
            while (r < recEvents.length && recEvents[r]!.t <= e.t) {
              recLevel = isOn(recEvents[r]!) ? 1 : 0;
              r++;
            }
            recording = recParam || recLevel > 0.5;
            if (recording && isOn(e)) table[cell(phaseAt(start, end, ctx.t0, ctx.t1, e.t))] = eventValue(e);
          }
          for (; r < recEvents.length; r++) recLevel = isOn(recEvents[r]!) ? 1 : 0;
        } else {
          for (const e of recEvents) recLevel = isOn(e) ? 1 : 0;
          recording = recParam || recLevel > 0.5;
          if (recording && input) table[cell(end)] = input.values[0]!;
        }

        const trig = outputs.control('trig');
        for (const hit of stepCrossings(start, end, size, ctx.t0, ctx.t1)) {
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1, value: table[mod(hit.step, size)] ?? 0 });
        }
        const x = mod(end, 1) * size;
        const i = Math.floor(x) % size;
        const a = table[i] ?? 0;
        const b = table[(i + 1) % size] ?? 0;
        outputs.control('out').values[0] = a + (b - a) * (x - Math.floor(x)) * ctx.param('smooth');
      },
      getState: () => ({ table: [...s.table], rec: recLevel }),
      setState(state) {
        const st = state as ArrayState & { rec?: number };
        s = { table: [...(st.table ?? [])] };
        recLevel = st.rec ?? 0;
      },
    };
  },
};

export default array;
