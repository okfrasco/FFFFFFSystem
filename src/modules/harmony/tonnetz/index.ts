/**
 * Tonnetz — cammina tra triadi con le trasformazioni neo-riemanniane:
 *   P  parallela (Do maggiore ↔ Do minore)
 *   L  scambio della sensibile (Do maggiore ↔ Mi minore)
 *   R  relativa (Do maggiore ↔ La minore)
 * Ogni trasformazione cambia una sola nota: le triadi scivolano. A ogni
 * trigger si fa un passo, scelto a caso con i pesi di P, L, R, oppure dalla
 * sequenza scritta in `sequence` (es. "PLR", "LPRP"). Il voicing segue il
 * voice leading a tre voci.
 */

import type { ModuleDefinition } from '../../../core/types';
import { NOTE_NAMES, diatonicFor, plr, triadPcs, voiceLead, writeField, type Triad } from '../theory';

export interface TonnetzConfig {
  sequence: string;
}

interface TonnetzState {
  triad: Triad;
  voicing: number[];
  step: number;
  path: Triad[];
}

const OPS = ['P', 'L', 'R'] as const;

export const tonnetz: ModuleDefinition = {
  manifest: {
    id: 'tonnetz',
    name: 'Tonnetz',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'reset', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'root', label: 'Partenza', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'minor', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['maggiore', 'minore'] },
      { id: 'mode', label: 'Passi', min: 0, max: 1, default: 0, kind: 'discrete', options: ['a caso', 'sequenza'] },
      { id: 'p', label: 'Peso P', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'l', label: 'Peso L', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'r', label: 'Peso R', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'octave', label: 'Registro', min: 36, max: 72, default: 55, kind: 'discrete' },
    ],
    seeded: true,
  },
  defaultConfig: { sequence: 'PLR' } satisfies TonnetzConfig,
  create(init) {
    let cfg = init.config as TonnetzConfig;
    let s: TonnetzState | null = null;
    const start = (root: number, minor: boolean, lo: number): TonnetzState => {
      const triad = { root, minor };
      return { triad, voicing: voiceLead([], triadPcs(triad), 3, lo, lo + 19), step: 0, path: [triad] };
    };
    return {
      process(ctx, inputs, outputs) {
        const lo = ctx.discrete('octave', 0);
        const change = outputs.control('change');
        for (const e of inputs.control('reset')?.events ?? []) if (e.kind !== 'gate' || e.on) s = null;
        if (!s) {
          s = start(ctx.discrete('root', 0), ctx.discrete('minor', 0) === 1, lo);
          change.events.push({ kind: 'trig', t: ctx.t0, voice: 0, vel: 1, value: -1 });
        }
        for (const e of inputs.control('trig')?.events ?? []) {
          if (e.kind === 'gate' && !e.on) continue;
          let op: number;
          const seq = cfg.sequence.toUpperCase().replace(/[^PLR]/g, '');
          if (ctx.discrete('mode', s.step) === 1 && seq.length > 0) op = OPS.indexOf(seq[s.step % seq.length] as (typeof OPS)[number]);
          else {
            const w = [ctx.param('p'), ctx.param('l'), ctx.param('r')];
            const sum = w[0]! + w[1]! + w[2]!;
            let x = ctx.rng.float() * (sum || 1);
            op = sum > 0 ? w.findIndex((wi) => (x -= wi) < 0) : ctx.rng.int(0, 3);
            if (op < 0) op = 2;
          }
          const triad = plr(s.triad, OPS[op]!);
          s = { triad, voicing: voiceLead(s.voicing, triadPcs(triad), 3, lo, lo + 19), step: s.step + 1, path: [...s.path.slice(-15), triad] };
          change.events.push({ kind: 'trig', t: e.t, voice: 0, vel: 1, value: op });
        }
        const pcs = triadPcs(s.triad);
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), s.voicing, diatonicFor(pcs, s.triad.root) ?? pcs);
      },
      setConfig(c) {
        cfg = c as TonnetzConfig;
      },
      getState: () => (s ? structuredClone(s) : null),
      setState(state) {
        s = state ? structuredClone(state as TonnetzState) : null;
      },
    };
  },
};

export default tonnetz;
