/**
 * Strum — sgrana gli accordi: le note che partono insieme (entro 2 ms)
 * vengono distribuite nel tempo, una ogni `time` secondi, in su (dal basso),
 * in giù, alternando a ogni accordo o a caso. `curve` accelera (< 0) o
 * rallenta (> 0) la sgranatura; `fade` abbassa la velocity delle ultime note.
 * Le durate si accorciano del ritardo, così le note finiscono insieme.
 */

import { EventQueue } from '../../../core/eventQueue';
import type { ControlEvent, ModuleDefinition, NoteEvent } from '../../../core/types';

export const DIRECTIONS = ['su', 'giù', 'alterna', 'a caso'] as const;

/** Ritardo della k-esima nota di n, con curvatura. */
export function strumOffset(k: number, n: number, time: number, curve: number): number {
  if (n <= 1) return 0;
  const x = k / (n - 1);
  return time * (n - 1) * Math.pow(x, Math.pow(2, curve));
}

export const strum: ModuleDefinition = {
  manifest: {
    id: 'strum',
    name: 'Strum',
    category: 'harmony',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'time', label: 'Tempo tra note', min: 0, max: 0.2, default: 0.03, kind: 'continuous', unit: 's' },
      { id: 'direction', label: 'Direzione', min: 0, max: DIRECTIONS.length - 1, default: 2, kind: 'discrete', options: [...DIRECTIONS] },
      { id: 'curve', label: 'Curva', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'fade', label: 'Smorza', min: 0, max: 1, default: 0.2, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const queue = new EventQueue();
    let chords = 0;
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const out = outputs.control('out', input?.values.length ?? 1);
        const notes = (input?.events ?? []).filter((e): e is NoteEvent => e.kind === 'note');
        for (const e of input?.events ?? []) if (e.kind !== 'note') out.events.push(e);
        // gruppi di note simultanee
        const sorted = [...notes].sort((a, b) => a.t - b.t);
        for (let i = 0; i < sorted.length; ) {
          let j = i + 1;
          while (j < sorted.length && sorted[j]!.t - sorted[i]!.t < 0.002) j++;
          const group = sorted.slice(i, j).sort((a, b) => a.pitch - b.pitch);
          i = j;
          const dir = ctx.discrete('direction', chords);
          const down = dir === 1 || (dir === 2 && chords % 2 === 1);
          if (dir === 3) {
            for (let k = group.length - 1; k > 0; k--) {
              const r = ctx.rng.int(0, k + 1);
              [group[k], group[r]] = [group[r]!, group[k]!];
            }
          } else if (down) group.reverse();
          chords++;
          group.forEach((e, k) => {
            const dt = strumOffset(k, group.length, ctx.param('time'), ctx.param('curve'));
            const vel = e.vel * (1 - ctx.param('fade') * (group.length > 1 ? k / (group.length - 1) : 0));
            const moved: ControlEvent = { ...e, t: e.t + dt, vel, dur: Math.max(0.01, e.dur - dt) };
            if (moved.t < ctx.t1) out.events.push(moved);
            else queue.push(moved);
          });
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
        out.events.sort((a, b) => a.t - b.t);
      },
      getState: () => ({ q: queue.getState(), chords }),
      setState(state) {
        const st = state as { q: ControlEvent[]; chords: number };
        queue.setState(st.q);
        chords = st.chords;
      },
    };
  },
};

export default strum;
