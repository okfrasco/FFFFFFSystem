/**
 * Automa 1D — un automa cellulare elementare di Wolfram (regola 0–255) su
 * una riga di `width` celle, chiusa ad anello. A ogni step nasce una nuova
 * generazione. Uscite:
 *   trig     quando la cella letta (`cell`) è viva
 *   row      le prime `voices` celle come gate poly (voce i = cella i)
 *   value    le prime 8 celle lette come numero (0–1), per le altezze
 *   density  la frazione di celle vive
 * `mutation` accende o spegne celle a caso: tiene vive le regole che si spengono.
 */

import { clockHits } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';

/** Una generazione della regola (ad anello). */
export function caStep(cells: number[], rule: number): number[] {
  const n = cells.length;
  return cells.map((_, i) => {
    const idx = (cells[(i - 1 + n) % n]! << 2) | (cells[i]! << 1) | cells[(i + 1) % n]!;
    return (rule >> idx) & 1;
  });
}

interface CaState {
  cells: number[];
  history: number[][];
  counter: number;
}

export const ca1d: ModuleDefinition = {
  manifest: {
    id: 'ca1d',
    name: 'Automa 1D',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'row', type: 'control', signal: 'gate', poly: true },
      { id: 'value', type: 'control', signal: 'value' },
      { id: 'density', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'rule', label: 'Regola', min: 0, max: 255, default: 30, kind: 'discrete' },
      { id: 'width', label: 'Celle', min: 8, max: 64, default: 32, kind: 'discrete' },
      { id: 'cell', label: 'Cella letta', min: 0, max: 63, default: 16, kind: 'discrete' },
      { id: 'voices', label: 'Voci riga', min: 1, max: 16, default: 8, kind: 'discrete' },
      { id: 'init', label: 'Inizio', min: 0, max: 1, default: 0, kind: 'discrete', options: ['centro', 'casuale'] },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'mutation', label: 'Mutazione', min: 0, max: 0.2, default: 0, kind: 'continuous' },
      { id: 'swing', label: 'Swing', min: -1, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    let s: CaState | null = null;
    return {
      process(ctx, inputs, outputs) {
        const width = ctx.discrete('width', 0);
        if (!s || s.cells.length !== width) {
          const cells = ctx.discrete('init', 0) === 1 ? Array.from({ length: width }, () => (ctx.rng.chance(0.5) ? 1 : 0)) : Array.from({ length: width }, (_, i) => (i === width >> 1 ? 1 : 0));
          s = { cells, history: [cells], counter: s?.counter ?? 0 };
        }
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const voices = ctx.discrete('voices', ctx.tick);
        const trig = outputs.control('trig');
        const row = outputs.control('row', voices);
        for (const hit of hits) {
          let next = caStep(s.cells, ctx.discrete('rule', hit.key));
          const m = ctx.param('mutation');
          if (m > 0) next = next.map((c) => (ctx.rng.chance(m) ? 1 - c : c));
          for (let i = 0; i < voices; i++) if (next[i] !== s.cells[i]) row.events.push({ kind: 'gate', t: hit.t, voice: i, on: next[i] === 1 });
          s.cells = next;
          s.history = [...s.history, next].slice(-32);
          const cell = ctx.discrete('cell', hit.key) % width;
          if (next[cell]) trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: hit.vel, value: cell });
        }
        for (let i = 0; i < voices; i++) row.values[i] = s.cells[i] ?? 0;
        let v8 = 0;
        for (let i = 0; i < 8; i++) v8 = v8 * 2 + (s.cells[i] ?? 0);
        outputs.control('value').values[0] = v8 / 255;
        outputs.control('density').values[0] = s.cells.reduce((a, b) => a + b, 0) / width;
        trig.values[0] = s.cells[ctx.discrete('cell', ctx.tick) % width] ?? 0;
      },
      getState: () => (s ? { cells: [...s.cells], history: s.history.map((r) => [...r]), counter: s.counter } : null),
      setState(state) {
        const st = state as CaState | null;
        s = st ? { cells: [...st.cells], history: st.history.map((r) => [...r]), counter: st.counter } : null;
      },
    };
  },
};

export default ca1d;
