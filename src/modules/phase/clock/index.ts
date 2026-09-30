/**
 * Clock — trasforma una fase in trigger e gate: `division` step per ciclo.
 * Con la battuta del Transport e division 16 sono i sedicesimi; con una fase
 * piegata (Ø Scale, e i futuri Ø Bend e Ø Swing) il clock segue la piegatura.
 *
 *   swing     sposta gli step dispari (2/3 = terzina, 1 = puntato)
 *   offset    anticipa o ritarda tutti gli step, fino a mezzo step
 *   gate      durata del gate in frazioni di step (la chiusura può cadere
 *             in un tick successivo: resta in attesa fino al suo istante)
 *   accento   velocity più bassa per gli step che non sono il primo del ciclo
 *
 * Polifonico: ogni voce della fase in ingresso ha il suo clock.
 * Il trigger porta l'indice dello step nel ciclo (0 … division−1).
 */

import { mod, stepCrossings } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

interface PendingOff {
  t: number;
  voice: number;
}

interface ClockState {
  pending: PendingOff[];
  level: number[];
  pos: number[];
}

const initial = (): ClockState => ({ pending: [], level: [], pos: [] });

export const clock: ModuleDefinition = {
  manifest: {
    id: 'clock',
    name: 'Clock',
    category: 'phase',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'gate', type: 'control', signal: 'gate', poly: true },
      { id: 'step', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'division', label: 'Divisioni', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'offset', label: 'Offset', min: -0.5, max: 0.5, default: 0, kind: 'continuous', unit: 'step' },
      { id: 'gate', label: 'Gate', min: 0.01, max: 1, default: 0.5, kind: 'continuous', unit: 'step' },
      { id: 'accent', label: 'Accento', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },

  create() {
    let s = initial();
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const voices = ph.end.length;
        const trig = outputs.control('trig', voices);
        const gate = outputs.control('gate', voices);
        const step = outputs.control('step', voices);

        // chiusure rimaste da tick precedenti
        const still: PendingOff[] = [];
        for (const p of s.pending) {
          if (p.t < ctx.t1) {
            gate.events.push({ kind: 'gate', t: Math.max(p.t, ctx.t0), voice: p.voice, on: false });
            s.level[p.voice] = 0;
          } else still.push(p);
        }
        s.pending = still;

        for (let v = 0; v < voices; v++) {
          const a = ph.start[v]!;
          const b = ph.end[v]!;
          const div = ctx.discrete('division', Math.floor(a), v);
          // l'offset sposta la griglia: si legge la fase spostata di offset step
          const off = ctx.param('offset', v) / div;
          const stepDur = b !== a ? Math.abs((ctx.t1 - ctx.t0) / ((b - a) * div)) : 0;
          for (const hit of stepCrossings(a - off, b - off, div, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const index = mod(hit.step, div);
            const vel = index === 0 ? 1 : 1 - ctx.param('accent', v);
            trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel, value: index });
            // un gate ancora aperto si chiude prima del nuovo
            const open = s.pending.findIndex((p) => p.voice === v);
            if (open >= 0) {
              gate.events.push({ kind: 'gate', t: hit.t, voice: v, on: false });
              s.pending.splice(open, 1);
            }
            gate.events.push({ kind: 'gate', t: hit.t, voice: v, on: true });
            s.level[v] = 1;
            const offAt = hit.t + ctx.param('gate', v) * stepDur;
            if (offAt < ctx.t1) {
              gate.events.push({ kind: 'gate', t: offAt, voice: v, on: false });
              s.level[v] = 0;
            } else s.pending.push({ t: offAt, voice: v });
            s.pos[v] = index / div;
          }
          trig.values[v] = s.level[v] ?? 0;
          gate.values[v] = s.level[v] ?? 0;
          step.values[v] = s.pos[v] ?? 0;
        }
        gate.events.sort((x, y) => x.t - y.t);
        trig.events.sort((x, y) => x.t - y.t);
      },
      getState: () => ({ pending: s.pending.map((p) => ({ ...p })), level: [...s.level], pos: [...s.pos] }),
      setState(state) {
        const st = state as ClockState;
        s = { pending: st.pending.map((p) => ({ ...p })), level: [...st.level], pos: [...st.pos] };
      },
    };
  },
};

export default clock;
