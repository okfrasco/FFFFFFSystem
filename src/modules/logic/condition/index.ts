/**
 * Condizione — lascia passare un trigger solo se una condizione è vera, alla
 * Elektron (trig condition). I cicli si contano sulla fase collegata (la
 * battuta, di solito); senza fase ogni trigger è un ciclo.
 *
 *   A:B        il ciclo A di ogni B (1:2 = cicli dispari, 4:4 = uno su quattro)
 *   NOT A:B    tutti tranne quello
 *   1ST        solo nel primo ciclo dopo l'avvio o il reset
 *   NOT 1ST    tutti tranne il primo
 *   PRE        solo se l'ultima condizione valutata qui era vera
 *   NOT PRE    solo se era falsa
 *   %          con probabilità `prob`
 */

import { mod } from '../../../core/phase';
import { eventsOf, isOn } from '../../../core/signals';
import { phaseAt } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

export const CONDITIONS = ['A:B', 'NOT A:B', '1ST', 'NOT 1ST', 'PRE', 'NOT PRE', '%'] as const;

/** La condizione per il ciclo `cycle` (0 = primo). */
export function conditionHolds(mode: number, cycle: number, a: number, b: number, pre: boolean, chance: boolean): boolean {
  const ab = mod(cycle, Math.max(1, b)) === Math.min(a, b) - 1;
  switch (mode) {
    case 0:
      return ab;
    case 1:
      return !ab;
    case 2:
      return cycle === 0;
    case 3:
      return cycle !== 0;
    case 4:
      return pre;
    case 5:
      return !pre;
    default:
      return chance;
  }
}

interface CondState {
  start: number | null;
  pre: boolean;
  count: number;
}

export const condition: ModuleDefinition = {
  manifest: {
    id: 'condition',
    name: 'Condizione',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
      { id: 'reset', type: 'control', signal: 'event' },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'mode', label: 'Condizione', min: 0, max: CONDITIONS.length - 1, default: 0, kind: 'discrete', options: [...CONDITIONS] },
      { id: 'a', label: 'A', min: 1, max: 8, default: 1, kind: 'discrete' },
      { id: 'b', label: 'B', min: 1, max: 8, default: 2, kind: 'discrete' },
      { id: 'prob', label: 'Probabilità', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    let s: CondState = { start: null, pre: false, count: 0 };
    return {
      process(ctx, inputs, outputs) {
        const T = inputs.control('trig');
        const ph = inputs.phase('phase');
        const out = outputs.control('trig', T?.values.length ?? 1);
        for (const e of eventsOf(inputs.control('reset'), 0).filter(isOn)) {
          void e;
          s = { start: null, pre: false, count: 0 };
        }
        for (const e of (T?.events ?? []).filter(isOn)) {
          let cycle: number;
          if (ph) {
            const p = phaseAt(ph.start[0]!, ph.end[0]!, ctx.t0, ctx.t1, e.t);
            s.start ??= Math.floor(p);
            cycle = Math.floor(p + 1e-9) - s.start;
          } else cycle = s.count++;
          const ok = conditionHolds(
            ctx.discrete('mode', cycle),
            cycle,
            ctx.discrete('a', cycle),
            ctx.discrete('b', cycle),
            s.pre,
            ctx.rng.chance(ctx.param('prob')),
          );
          // PRE guarda la valutazione precedente: per le condizioni PRE non si aggiorna
          if (ctx.discrete('mode', cycle) < 4 || ctx.discrete('mode', cycle) === 6) s.pre = ok;
          if (ok) out.events.push({ ...e });
        }
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as CondState) };
      },
    };
  },
};

export default condition;
