/**
 * Humanize — micro-spostamenti: ogni evento arriva un po' dopo (fino a
 * `time` secondi) e con la velocity un po' diversa (± `velocity`). Gli
 * spostamenti sono in avanti: il grafo non può suonare nel passato.
 * `drift` li rende correlati (un'onda lenta) invece che indipendenti.
 */

import { EventQueue } from '../../../core/eventQueue';
import { hash01 } from '../../../core/rng';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export const humanize: ModuleDefinition = {
  manifest: {
    id: 'humanize',
    name: 'Humanize',
    category: 'transform',
    rate: 'control',
    inputs: [{ id: 'in', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'time', label: 'Tempo', min: 0, max: 0.06, default: 0.012, kind: 'continuous', unit: 's' },
      { id: 'velocity', label: 'Velocity', min: 0, max: 0.5, default: 0.15, kind: 'continuous' },
      { id: 'drift', label: 'Correlazione', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    const queue = new EventQueue();
    const seed = init.seed;
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const out = outputs.control('out', input?.values.length ?? 1);
        for (const e of input?.events ?? []) {
          const corr = ctx.param('drift');
          // parte correlata: un'onda lenta sul tempo (0.3 Hz); parte libera: per evento
          const slow = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.3 * e.t + hash01(seed, e.voice) * 6.28);
          const own = ctx.rng.float();
          const u = corr * slow + (1 - corr) * own;
          const t = e.t + u * ctx.param('time');
          const moved: ControlEvent =
            e.kind === 'gate' ? { ...e, t } : { ...e, t, vel: Math.max(0.02, Math.min(1, e.vel * (1 + (ctx.rng.float() * 2 - 1) * ctx.param('velocity')))) };
          queue.push(moved);
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
      },
      getState: () => queue.getState(),
      setState(state) {
        queue.setState(state as ControlEvent[]);
      },
    };
  },
};

export default humanize;
