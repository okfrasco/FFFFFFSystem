/**
 * Groove template — una tabella di micro-offset per step (in frazioni di
 * step, −1…1) e di velocity (0–1): ogni colpo prende l'offset e la velocity
 * dello step più vicino. `amount` porta dal dritto (0) al template pieno (1).
 * Si disegna nel nodo; in futuro si potrà estrarre da un loop o da un MIDI.
 * Serve la fase (per sapere lo step e quanto dura).
 */

import { EventQueue, emitShifted } from '../../../core/eventQueue';
import { phaseAt } from '../../../core/phase';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

export interface GrooveTemplateConfig {
  offsets: number[];
  velocity: number[];
}

export const grooveTemplate: ModuleDefinition = {
  manifest: {
    id: 'grooveTemplate',
    name: 'Groove template',
    category: 'groove',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'division', label: 'Step per ciclo', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'amount', label: 'Quantità', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: {
    // un groove "trascinato": gli step dispari indietro, i tempi deboli più piano
    offsets: [0, 0.12, 0.02, 0.18, -0.02, 0.1, 0.04, 0.2, 0, 0.12, 0.02, 0.16, -0.03, 0.1, 0.05, 0.22],
    velocity: [1, 0.55, 0.75, 0.5, 0.95, 0.55, 0.7, 0.45, 1, 0.55, 0.75, 0.5, 0.9, 0.6, 0.7, 0.5],
  } satisfies GrooveTemplateConfig,
  create(init) {
    let cfg = init.config as GrooveTemplateConfig;
    const queue = new EventQueue();
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const ph = inputs.phase('phase');
        const out = outputs.control('out', input?.values.length ?? 1);
        const speed = ph ? (ph.end[0]! - ph.start[0]!) / Math.max(1e-9, ctx.dt) : 0;
        const div = ctx.discrete('division', ctx.tick);
        const amt = ctx.param('amount');
        for (const e of input?.events ?? []) {
          if (!ph || !(speed > 0) || e.kind === 'gate') {
            out.events.push(e);
            continue;
          }
          const p = phaseAt(ph.start[0]!, ph.end[0]!, ctx.t0, ctx.t1, e.t);
          const step = Math.round(p * div);
          const n = cfg.offsets.length || 1;
          const i = ((step % n) + n) % n;
          const off = (cfg.offsets[i] ?? 0) * amt;
          const velScale = 1 + ((cfg.velocity[i % (cfg.velocity.length || 1)] ?? 1) - 1) * amt;
          emitShifted({ ...e, vel: Math.max(0.02, Math.min(1, e.vel * velScale)) } as ControlEvent, off / (div * speed), ctx.t1, out.events, queue);
        }
        queue.flush(ctx.t0, ctx.t1, out.events);
        out.events.sort((x, y) => x.t - y.t);
      },
      setConfig(c) {
        cfg = c as GrooveTemplateConfig;
      },
      getState: () => queue.getState(),
      setState(state) {
        queue.setState(state as ControlEvent[]);
      },
    };
  },
};

export default grooveTemplate;
