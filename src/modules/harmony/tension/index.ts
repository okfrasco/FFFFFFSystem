/**
 * Tensione — una macro che porta l'accordo del campo verso il teso: salendo
 * con `amount` aggiunge la settima, la nona, poi altera (♭9, ♯11, ♭13, ♯9)
 * e stringe il voicing in cluster. Le note aggiunte stanno sopra
 * l'accordo; la fondamentale è la nota più bassa. Anche la scala in uscita si
 * allarga con le alterazioni, così le melodie quantizzate le seguono.
 */

import type { ModuleDefinition } from '../../../core/types';
import { pc, readChord, readScale, sameNotes, writeField } from '../theory';

/** Intervalli aggiunti (dalla fondamentale) a ogni livello di tensione. */
export function tensionTones(pcs: readonly number[], root: number, amount: number): number[] {
  const has = (i: number) => pcs.includes(pc(root + i));
  const minor = has(3) && !has(4);
  const add: number[] = [];
  if (amount > 0.15 && !has(10) && !has(11)) add.push(minor ? 10 : has(11) ? 11 : 10);
  if (amount > 0.35) add.push(14);
  if (amount > 0.55) {
    add.splice(add.indexOf(14), 1, 13); // la nona diventa ♭9
    add.push(18); // ♯11
  }
  if (amount > 0.75) add.push(20); // ♭13
  if (amount > 0.9 && !minor) add.push(15); // ♯9
  return add;
}

export function tense(chord: readonly number[], amount: number): number[] {
  if (chord.length === 0) return [];
  const sorted = [...chord].sort((a, b) => a - b);
  const root = sorted[0]!;
  const top = sorted.at(-1)!;
  const add = tensionTones(sorted.map(pc), pc(root), amount).map((i) => {
    let x = root + i;
    while (x <= top - 12) x += 12;
    return x;
  });
  let notes = [...new Set([...sorted, ...add])].sort((a, b) => a - b);
  // sopra 0.8 il voicing si stringe: tutto (tranne il basso) dentro un'ottava sopra la seconda nota
  if (amount > 0.8 && notes.length > 2) {
    const floor = notes[1]!;
    notes = [notes[0]!, ...[...new Set(notes.slice(1).map((p) => floor + pc(p - floor)))].sort((a, b) => a - b)];
  }
  return notes;
}

export const tension: ModuleDefinition = {
  manifest: {
    id: 'tension',
    name: 'Tensione',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
    ],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'scale', type: 'control', signal: 'value', poly: true },
      { id: 'change', type: 'control', signal: 'event' },
    ],
    params: [{ id: 'amount', label: 'Tensione', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
    seeded: false,
  },
  create() {
    let last: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = readChord(inputs.control('chord'));
        if (input.length === 0) return;
        const chord = tense(input, ctx.param('amount'));
        const inScale = readScale(inputs.control('scale')) ?? [];
        const scale = [...new Set([...inScale, ...chord.map(pc)])].sort((a, b) => a - b);
        writeField((n) => outputs.control('chord', n), (n) => outputs.control('scale', n), chord, scale);
        if (!sameNotes(chord, last)) {
          outputs.control('change').events.push({ kind: 'trig', t: ctx.t0, voice: 0, vel: 1, value: pc(chord[0]!) });
          last = chord;
        }
      },
      getState: () => ({ last: [...last] }),
      setState(state) {
        last = [...((state as { last?: number[] }).last ?? [])];
      },
    };
  },
};

export default tension;
