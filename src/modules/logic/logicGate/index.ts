/**
 * Porte logiche — AND, OR, XOR, NOT, NAND, NOR sui livelli di due ingressi.
 *
 * Come conta un ingresso:
 *   gate      il suo livello, con aperture e chiusure agli istanti esatti
 *   trigger   un impulso lungo `pulse` secondi
 *   valore    acceso sopra 0.5 (cambia al tick)
 * L'uscita è un gate che cambia agli istanti esatti in cui cambia il
 * risultato, più un trigger a ogni accensione. NOT usa solo A.
 * (Il modulo AND a parte ragiona per coincidenza di colpi, non per livelli.)
 */

import { readVoice } from '../../../core/signals';
import type { ControlBuffer, ModuleDefinition } from '../../../core/types';

export const LOGIC_OPS = ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR'] as const;

export function logic(op: number, a: boolean, b: boolean): boolean {
  switch (op) {
    case 0:
      return a && b;
    case 1:
      return a || b;
    case 2:
      return a !== b;
    case 3:
      return !a;
    case 4:
      return !(a && b);
    default:
      return !(a || b);
  }
}

interface InState {
  level: boolean;
  /** Fine degli impulsi dei trigger ancora aperti. */
  offs: number[];
  /** L'ingresso ha portato eventi: da lì in poi conta solo per quelli, non per i valori. */
  eventful: boolean;
}

interface GateState {
  a: InState[];
  b: InState[];
  out: boolean[];
}

type Change = { t: number; which: 'a' | 'b'; on: boolean; order: number };

/** Cambi di livello di un ingresso dentro il tick [t0, t1). */
function changesOf(buf: ControlBuffer | undefined, v: number, st: InState, which: 'a' | 'b', t0: number, t1: number, pulse: number): Change[] {
  const out: Change[] = [];
  let order = 0;
  const due = st.offs.filter((t) => t < t1);
  st.offs = st.offs.filter((t) => t >= t1);
  for (const t of due) out.push({ t: Math.max(t, t0), which, on: false, order: order++ });
  if (!buf) return out;
  const n = buf.values.length;
  const evs = buf.events.filter((e) => n <= 1 || e.voice % n === v % n);
  if (evs.length) st.eventful = true;
  if (!st.eventful) {
    // solo valori: il livello cambia al tick
    const lvl = readVoice(buf.values, v) >= 0.5;
    if (lvl !== st.level && !due.length) out.push({ t: t0, which, on: lvl, order: order++ });
    return out;
  }
  for (const e of evs) {
    if (e.kind === 'gate') out.push({ t: e.t, which, on: e.on, order: order++ });
    else {
      out.push({ t: e.t, which, on: true, order: order++ });
      const off = e.t + pulse;
      if (off < t1) out.push({ t: off, which, on: false, order: order++ });
      else st.offs.push(off);
    }
  }
  return out;
}

export const logicGate: ModuleDefinition = {
  manifest: {
    id: 'logicGate',
    name: 'Porte logiche',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'a', type: 'control', poly: true },
      { id: 'b', type: 'control', poly: true },
    ],
    outputs: [
      { id: 'gate', type: 'control', signal: 'gate', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'op', label: 'Porta', min: 0, max: LOGIC_OPS.length - 1, default: 1, kind: 'discrete', options: [...LOGIC_OPS] },
      { id: 'pulse', label: 'Impulso', min: 0.001, max: 0.2, default: 0.01, kind: 'continuous', curve: 'exp', unit: 's' },
    ],
    seeded: false,
  },
  create() {
    let s: GateState = { a: [], b: [], out: [] };
    return {
      process(ctx, inputs, outputs) {
        const A = inputs.control('a');
        const B = inputs.control('b');
        const n = Math.max(A?.values.length ?? 1, B?.values.length ?? 1);
        const gate = outputs.control('gate', n);
        const trig = outputs.control('trig', n);
        const op = ctx.discrete('op', ctx.tick);
        const pulse = ctx.param('pulse');
        for (let v = 0; v < n; v++) {
          const sa = (s.a[v] ??= { level: false, offs: [], eventful: false });
          const sb = (s.b[v] ??= { level: false, offs: [], eventful: false });
          const changes = [...changesOf(A, v, sa, 'a', ctx.t0, ctx.t1, pulse), ...changesOf(B, v, sb, 'b', ctx.t0, ctx.t1, pulse)];
          changes.sort((x, y) => x.t - y.t || (x.on === y.on ? x.order - y.order : x.on ? 1 : -1));
          let out = s.out[v] ?? logic(op, sa.level, sb.level);
          for (let i = 0; i < changes.length; i++) {
            const c = changes[i]!;
            (c.which === 'a' ? sa : sb).level = c.on;
            // i cambi nello stesso istante si applicano tutti prima di valutare
            // (A che chiude e B che apre insieme non devono dare un buco)
            if (i + 1 < changes.length && Math.abs(changes[i + 1]!.t - c.t) < 1e-9) continue;
            const next = logic(op, sa.level, sb.level);
            if (next === out) continue;
            out = next;
            gate.events.push({ kind: 'gate', t: c.t, voice: v, on: next });
            if (next) trig.events.push({ kind: 'trig', t: c.t, voice: v, vel: 1 });
          }
          // la porta cambiata a metà (es. da AND a NOR) vale subito
          const now = logic(op, sa.level, sb.level);
          if (now !== out) {
            out = now;
            gate.events.push({ kind: 'gate', t: ctx.t0, voice: v, on: now });
            if (now) trig.events.push({ kind: 'trig', t: ctx.t0, voice: v, vel: 1 });
          }
          s.out[v] = out;
          gate.values[v] = out ? 1 : 0;
          trig.values[v] = out ? 1 : 0;
        }
        gate.events.sort((x, y) => x.t - y.t);
        trig.events.sort((x, y) => x.t - y.t);
      },
      getState: () => ({ a: s.a.map((x) => ({ ...x, offs: [...x.offs] })), b: s.b.map((x) => ({ ...x, offs: [...x.offs] })), out: [...s.out] }),
      setState(state) {
        const st = state as GateState;
        s = { a: st.a.map((x) => ({ ...x, offs: [...x.offs] })), b: st.b.map((x) => ({ ...x, offs: [...x.offs] })), out: [...st.out] };
      },
    };
  },
};

export default logicGate;
