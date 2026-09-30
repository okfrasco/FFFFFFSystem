/**
 * Logic Delay — ritarda l'apertura e la chiusura di un gate con tempi
 * diversi:
 *   ritardo apertura   l'ingresso deve restare alto così a lungo perché
 *                      l'uscita si apra (i colpi più brevi spariscono)
 *   ritardo chiusura   l'uscita resta aperta così a lungo dopo che
 *                      l'ingresso si è chiuso (allunga il gate)
 * Un trigger è un gate lungo zero: con ritardo apertura 0 diventa un gate
 * lungo quanto il ritardo di chiusura (allungatore di impulsi).
 */

import { eventsOf } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

interface DelayState {
  input: boolean;
  output: boolean;
  rise: number | null;
  fall: number | null;
}

export const logicDelay: ModuleDefinition = {
  manifest: {
    id: 'logicDelay',
    name: 'Logic Delay',
    category: 'logic',
    rate: 'control',
    inputs: [{ id: 'gate', type: 'control', signal: 'gate' }],
    outputs: [{ id: 'gate', type: 'control', signal: 'gate' }],
    params: [
      { id: 'on', label: 'Ritardo apertura', min: 0, max: 2, default: 0, kind: 'continuous', unit: 's' },
      { id: 'off', label: 'Ritardo chiusura', min: 0, max: 2, default: 0.2, kind: 'continuous', unit: 's' },
    ],
    seeded: false,
  },
  create() {
    let s: DelayState = { input: false, output: false, rise: null, fall: null };
    return {
      process(ctx, inputs, outputs) {
        const out = outputs.control('gate');
        const don = ctx.param('on');
        const doff = ctx.param('off');
        // gli edge in ingresso: un trigger è un'apertura e una chiusura nello stesso istante
        const edges: { t: number; on: boolean }[] = [];
        for (const e of eventsOf(inputs.control('gate'), 0)) {
          if (e.kind === 'gate') edges.push({ t: e.t, on: e.on });
          else edges.push({ t: e.t, on: true }, { t: e.t, on: false });
        }
        const emit = (t: number, on: boolean) => {
          if (s.output === on) return;
          s.output = on;
          out.events.push({ kind: 'gate', t: Math.max(t, ctx.t0), voice: 0, on });
        };
        const settle = (until: number) => {
          // esegue le aperture e chiusure in attesa che cadono prima di `until`
          for (;;) {
            const r = s.rise !== null && s.rise < until ? s.rise : Infinity;
            const f = s.fall !== null && s.fall < until ? s.fall : Infinity;
            if (r === Infinity && f === Infinity) return;
            if (r <= f) {
              s.rise = null;
              emit(r, true);
            } else {
              s.fall = null;
              emit(f, false);
            }
          }
        };
        for (const e of edges) {
          settle(e.t);
          if (e.on) {
            s.input = true;
            s.fall = null;
            if (!s.output) s.rise = e.t + don;
            if (don === 0) settle(e.t + 1e-12);
          } else {
            s.input = false;
            s.rise = null;
            if (s.output) s.fall = e.t + doff;
          }
        }
        settle(ctx.t1);
        out.values[0] = s.output ? 1 : 0;
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as DelayState) };
      },
    };
  },
};

export default logicDelay;
