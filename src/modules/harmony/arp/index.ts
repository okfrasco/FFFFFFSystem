/**
 * Arp — dall'accordo del campo a un pattern, letto dalla fase (`steps` per
 * ciclo) o avanzato dai trigger. Pattern: su, giù, su-giù, giù-su, casuale,
 * ordine dell'accordo, accordo intero. `octaves` ripete le note più in alto.
 */

import { clockHits, mod } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';
import { readChord } from '../theory';

export const PATTERNS = ['su', 'giù', 'su-giù', 'giù-su', 'casuale', 'ordine', 'accordo'] as const;

/** La sequenza di un ciclo del pattern (indici nella lista `notes` crescente). */
export function arpOrder(n: number, pattern: number): number[] {
  const up = Array.from({ length: n }, (_, i) => i);
  const down = [...up].reverse();
  switch (pattern) {
    case 1:
      return down;
    case 2:
      return n > 1 ? [...up, ...down.slice(1, -1)] : up;
    case 3:
      return n > 1 ? [...down, ...up.slice(1, -1)] : up;
    default:
      return up;
  }
}

export const arp: ModuleDefinition = {
  manifest: {
    id: 'arp',
    name: 'Arp',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [{ id: 'note', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 32, default: 16, kind: 'discrete' },
      { id: 'pattern', label: 'Pattern', min: 0, max: PATTERNS.length - 1, default: 2, kind: 'discrete', options: [...PATTERNS] },
      { id: 'octaves', label: 'Ottave', min: 1, max: 4, default: 2, kind: 'discrete' },
      { id: 'length', label: 'Durata', min: 0.05, max: 4, default: 0.6, kind: 'continuous', curve: 'exp', unit: 'step' },
      { id: 'vel', label: 'Velocity', min: 0.05, max: 1, default: 0.7, kind: 'continuous' },
      { id: 'accent', label: 'Accento', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const counter = { n: 0 };
    let pos = 0;
    return {
      process(ctx, inputs, outputs) {
        const raw = readChord(inputs.control('chord'));
        const chord = [...new Set(raw)].sort((a, b) => a - b);
        const note = outputs.control('note');
        if (chord.length === 0) return;
        const octaves = ctx.discrete('octaves', 0);
        const notes: number[] = [];
        for (let o = 0; o < octaves; o++) for (const p of chord) notes.push(p + 12 * o);
        const ph = inputs.phase('phase');
        const speed = ph ? Math.abs(ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const steps = ctx.discrete('steps', 0);
        const stepDur = speed > 0 ? 1 / (speed * steps) : 0.125;
        const dur = ctx.param('length') * stepDur;
        for (const hit of clockHits(ctx, inputs, counter)) {
          const pattern = ctx.discrete('pattern', hit.key);
          const vel = Math.min(1, ctx.param('vel') * hit.vel * (1 + ctx.param('accent') * (mod(hit.key, 4) === 0 ? 1 : -0.5)));
          if (pattern === 6) {
            chord.forEach((p, i) => note.events.push({ kind: 'note', t: hit.t, voice: i, pitch: p, vel, dur }));
            continue;
          }
          let idx: number;
          if (pattern === 4) idx = ctx.rng.int(0, notes.length);
          else if (pattern === 5) {
            // l'ordine dell'accordo in ingresso (voce 0 per prima), ottava per ottava
            const k = mod(pos++, raw.length * octaves);
            note.events.push({ kind: 'note', t: hit.t, voice: 0, pitch: raw[k % raw.length]! + 12 * Math.floor(k / raw.length), vel, dur });
            continue;
          } else {
            const order = arpOrder(notes.length, pattern);
            idx = order[mod(ph && !inputs.control('trig') ? hit.key : pos++, order.length)]!;
          }
          note.events.push({ kind: 'note', t: hit.t, voice: 0, pitch: notes[idx]!, vel, dur });
        }
      },
      getState: () => ({ n: counter.n, pos }),
      setState(state) {
        const st = state as { n: number; pos: number };
        counter.n = st.n;
        pos = st.pos;
      },
    };
  },
};

export default arp;
