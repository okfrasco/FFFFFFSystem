/**
 * Cerchio delle quinte — cammina per tonalità a ogni trigger:
 *   quinte      la tonica si sposta di `step` quinte, il modo resta
 *   brightness  la tonica resta e il modo scende (o sale) di `step` gradi di
 *               brightness, lidio → ionio → … → locrio; oltre il locrio si
 *               passa al lidio un semitono sotto: ogni passo cambia una nota
 * `turn` è la probabilità di fare il passo al contrario. Uscite del campo:
 * scala, tonica, la triade (o la settima) sulla tonica, change.
 */

import type { ModuleDefinition } from '../../../core/types';
import { MODES, NOTE_NAMES, brightnessMode, diatonicChord, pc, scalePcs, writeField } from '../theory';

interface FifthsState {
  root: number;
  /** Posizione di brightness (0 = il modo di partenza). */
  n: number;
  key: number;
}

export function fifthsKey(root0: number, mode0: number, walk: number, st: { root: number; n: number }): { root: number; mode: number } {
  if (walk === 0) return { root: st.root, mode: mode0 };
  return brightnessMode(root0, mode0 + st.n);
}

export const fifths: ModuleDefinition = {
  manifest: {
    id: 'fifths',
    name: 'Cerchio delle quinte',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'reset', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'root', type: 'control', signal: 'value' },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'root', label: 'Tonica', min: 0, max: 11, default: 0, kind: 'discrete', options: NOTE_NAMES },
      { id: 'mode', label: 'Modo', min: 0, max: 6, default: 1, kind: 'discrete', options: MODES.map((m) => m.name) },
      { id: 'walk', label: 'Cammino', min: 0, max: 1, default: 0, kind: 'discrete', options: ['quinte', 'brightness'] },
      { id: 'step', label: 'Passo', min: -3, max: 3, default: 1, kind: 'discrete' },
      { id: 'turn', label: 'Al contrario', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'size', label: 'Note accordo', min: 1, max: 5, default: 3, kind: 'discrete' },
      { id: 'octave', label: 'Ottava', min: 36, max: 72, default: 48, kind: 'discrete' },
    ],
    seeded: true,
  },
  create() {
    let s: FifthsState | null = null;
    return {
      process(ctx, inputs, outputs) {
        const root0 = ctx.discrete('root', 0);
        const walk = ctx.discrete('walk', 0);
        const change = outputs.control('change');
        for (const e of inputs.control('reset')?.events ?? []) if (e.kind !== 'gate' || e.on) s = null;
        if (!s) s = { root: root0, n: 0, key: 0 };
        for (const e of inputs.control('trig')?.events ?? []) {
          if (e.kind === 'gate' && !e.on) continue;
          let step = ctx.discrete('step', s.key);
          if (ctx.rng.chance(ctx.param('turn'))) step = -step;
          s = walk === 0 ? { ...s, root: pc(s.root + 7 * step), key: s.key + 1 } : { ...s, n: s.n + step, key: s.key + 1 };
          change.events.push({ kind: 'trig', t: e.t, voice: 0, vel: 1, value: fifthsKey(root0, ctx.discrete('mode', 0), walk, s).root });
        }
        const k = fifthsKey(root0, ctx.discrete('mode', 0), walk, s);
        const steps = MODES[k.mode]!.steps;
        const scale = scalePcs(k.root, steps);
        const base = ctx.discrete('octave', 0);
        const chord = diatonicChord(steps.map((x) => x + k.root), 0, ctx.discrete('size', 0)).map((p) => base + p);
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), chord, scale);
        outputs.control('root').values[0] = k.root;
      },
      getState: () => (s ? { ...s } : null),
      setState(state) {
        s = state ? { ...(state as FifthsState) } : null;
      },
    };
  },
};

export default fifths;
