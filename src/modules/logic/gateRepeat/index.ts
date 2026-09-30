/**
 * Gate Repeat — finché l'ingresso è alto, ripete trigger a intervalli
 * regolari a partire dall'apertura (ratchet su un gate tenuto). Con la fase
 * collegata l'intervallo è in cicli (0.0625 = sedicesimi di battuta).
 */

import { eventsOf } from '../../../core/signals';
import { readVoice } from '../../../core/signals';
import type { ModuleDefinition } from '../../../core/types';

interface RepState {
  high: boolean;
  next: number;
}

export const gateRepeat: ModuleDefinition = {
  manifest: {
    id: 'gateRepeat',
    name: 'Gate Repeat',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'gate', type: 'control', signal: 'gate' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [
      { id: 'rate', label: 'Intervallo', min: 0.005, max: 2, default: 0.0625, kind: 'continuous', curve: 'exp' },
      { id: 'decay', label: 'Decadimento', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: RepState = { high: false, next: NaN };
    let count = 0;
    return {
      process(ctx, inputs, outputs) {
        const G = inputs.control('gate');
        const ph = inputs.phase('phase');
        const out = outputs.control('trig');
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const period = Math.max(0.002, ph ? (speed > 0 ? ctx.param('rate') / speed : Infinity) : ctx.param('rate'));
        const decay = ctx.param('decay');
        const emitUntil = (t: number) => {
          while (s.high && s.next < t) {
            out.events.push({ kind: 'trig', t: Math.max(s.next, ctx.t0), voice: 0, vel: Math.max(0.05, Math.pow(1 - decay, count)) });
            count++;
            s.next += period;
          }
        };
        const evs = eventsOf(G, 0);
        if (evs.length === 0 && G) {
          // solo livello: cambia al tick
          const lvl = readVoice(G.values, 0) >= 0.5;
          if (lvl && !s.high) {
            s.high = true;
            s.next = ctx.t0;
            count = 0;
          } else if (!lvl) s.high = false;
        }
        for (const e of evs) {
          emitUntil(e.t);
          const on = e.kind !== 'gate' || e.on;
          if (on) {
            s.high = true;
            s.next = e.t;
            count = 0;
          } else s.high = false;
        }
        emitUntil(ctx.t1);
        out.values[0] = s.high ? 1 : 0;
      },
      getState: () => ({ ...s, count }),
      setState(state) {
        const st = state as RepState & { count: number };
        s = { high: st.high, next: st.next };
        count = st.count;
      },
    };
  },
};

export default gateRepeat;
