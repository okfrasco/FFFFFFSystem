/**
 * Transpose / Octave — sposta note e accordi per semitoni, ottave e gradi.
 * I gradi si contano sulla scala del campo (`scale` collegato) o, senza, sulla
 * scala cromatica: +2 gradi in Do maggiore porta Do→Mi, Si→Re.
 * Lavora sulle note (`note`), sugli accordi (`chord`) e sui valori dei
 * trigger che portano una nota.
 */

import type { ModuleDefinition } from '../../../core/types';
import { pc, readChord, readScale } from '../theory';

/** Sposta una nota di `degrees` gradi della scala (la nota fuori scala va sulla più vicina sotto). */
export function moveDegrees(p: number, degrees: number, scale: readonly number[]): number {
  if (degrees === 0 || scale.length === 0) return p;
  const n = scale.length;
  const oct = Math.floor(p / 12);
  let idx = -1;
  for (let i = 0; i < n; i++) if (scale[i]! <= pc(p)) idx = i;
  let base = oct * 12;
  if (idx < 0) {
    idx = n - 1;
    base -= 12;
  }
  const frac = p - (base + scale[idx]!); // eventuale distanza fuori scala o microtono
  const k = idx + degrees;
  const o = Math.floor(k / n);
  return base + 12 * o + scale[k - o * n]! + frac;
}

export const transpose: ModuleDefinition = {
  manifest: {
    id: 'transpose',
    name: 'Transpose / Octave',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
    ],
    outputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'chord', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'semitones', label: 'Semitoni', min: -24, max: 24, default: 0, kind: 'discrete' },
      { id: 'octaves', label: 'Ottave', min: -4, max: 4, default: 0, kind: 'discrete' },
      { id: 'degrees', label: 'Gradi', min: -14, max: 14, default: 0, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let counter = 0;
    return {
      process(ctx, inputs, outputs) {
        const scale = readScale(inputs.control('scale')) ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const move = (p: number, key: number) =>
          moveDegrees(p, ctx.discrete('degrees', key), scale) + ctx.discrete('semitones', key) + 12 * ctx.discrete('octaves', key);
        const input = inputs.control('note');
        const out = outputs.control('note', input?.values.length ?? 1);
        for (const e of input?.events ?? []) {
          const key = counter++;
          if (e.kind === 'note') out.events.push({ ...e, pitch: move(e.pitch, key) });
          else if (e.kind === 'trig' && e.value !== undefined) out.events.push({ ...e, value: move(e.value, key) });
          else out.events.push(e);
        }
        const chord = readChord(inputs.control('chord'));
        if (chord.length) {
          const c = outputs.control('chord', chord.length);
          chord.forEach((p, i) => (c.values[i] = move(p, 0)));
        }
      },
      getState: () => ({ counter }),
      setState(state) {
        counter = (state as { counter: number }).counter;
      },
    };
  },
};

export default transpose;
