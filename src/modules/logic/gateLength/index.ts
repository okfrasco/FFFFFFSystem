/**
 * Gate Length — ogni trigger diventa un gate di durata fissa. Con la fase
 * collegata la durata è in cicli (0.125 = un ottavo di battuta), senza in
 * secondi. Un nuovo trigger con il gate ancora aperto lo chiude e lo riapre.
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

interface GlState {
  offAt: number[];
}

export const gateLength: ModuleDefinition = {
  manifest: {
    id: 'gateLength',
    name: 'Gate Length',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'gate', type: 'control', signal: 'gate', poly: true }],
    params: [{ id: 'length', label: 'Durata', min: 0.001, max: 4, default: 0.1, kind: 'continuous', curve: 'exp' }],
    seeded: false,
  },
  create() {
    let s: GlState = { offAt: [] };
    return {
      process(ctx, inputs, outputs) {
        const T = inputs.control('trig');
        const ph = inputs.phase('phase');
        const n = T?.values.length ?? 1;
        const gate = outputs.control('gate', n);
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        for (let v = 0; v < n; v++) {
          const len = ph ? (speed > 0 ? ctx.param('length', v) / speed : 0) : ctx.param('length', v);
          const close = (t: number) => {
            gate.events.push({ kind: 'gate', t, voice: v, on: false });
            s.offAt[v] = NaN;
          };
          for (const e of eventsOf(T, v).filter(isOn)) {
            const pending = s.offAt[v];
            if (pending !== undefined && Number.isFinite(pending)) {
              if (pending <= e.t) close(pending);
              else close(e.t);
            }
            gate.events.push({ kind: 'gate', t: e.t, voice: v, on: true });
            s.offAt[v] = e.t + len;
          }
          const pending = s.offAt[v];
          if (pending !== undefined && Number.isFinite(pending) && pending < ctx.t1) close(Math.max(ctx.t0, pending));
          gate.values[v] = Number.isFinite(s.offAt[v] ?? NaN) ? 1 : 0;
        }
        gate.events.sort((a, b) => a.t - b.t);
      },
      getState: () => ({ offAt: s.offAt.map((x) => (Number.isFinite(x) ? x : -1)) }),
      setState(state) {
        s = { offAt: (state as GlState).offAt.map((x) => (x < 0 ? NaN : x)) };
      },
    };
  },
};

export default gateLength;
