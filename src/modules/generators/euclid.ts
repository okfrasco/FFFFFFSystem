/**
 * Euclideo — K impulsi distribuiti su N step (algoritmo di Bjorklund), con
 * rotazione. Gli N step coprono un ciclo della fase in ingresso.
 *
 * Polifonico: ogni voce della fase in ingresso (es. da Ø Split) suona il
 * proprio pattern, con parametri per voce.
 * Mutazione: probabilità di invertire uno step (ghost note o pausa), fino a
 * metà degli step a mutazione 1.
 */

import { mod, stepCrossings } from '../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../core/types';

/** Pattern euclideo canonico (Bjorklund / Toussaint), senza rotazione. */
export function bjorklund(pulses: number, steps: number): boolean[] {
  const n = Math.max(0, Math.floor(steps));
  const k = Math.max(0, Math.min(n, Math.floor(pulses)));
  if (k === 0) return new Array<boolean>(n).fill(false);
  if (k === n) return new Array<boolean>(n).fill(true);
  let a: number[][] = Array.from({ length: k }, () => [1]);
  let b: number[][] = Array.from({ length: n - k }, () => [0]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const joined = a.slice(0, m).map((x, i) => x.concat(b[i] as number[]));
    const rest = a.length > m ? a.slice(m) : b.slice(m);
    a = joined;
    b = rest;
  }
  return [...a, ...b].flat().map((x) => x === 1);
}

interface EuclidState {
  level: number[];
}

export const euclid: ModuleDefinition = {
  manifest: {
    id: 'euclid',
    name: 'Euclideo',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase', poly: true }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event', poly: true },
      { id: 'gate', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'steps', label: 'Step', min: 1, max: 64, default: 16, kind: 'discrete' },
      { id: 'pulses', label: 'Impulsi', min: 0, max: 64, default: 4, kind: 'discrete' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 63, default: 0, kind: 'discrete' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },

  create() {
    let s: EuclidState = { level: [] };
    const cache = new Map<string, boolean[]>();
    const pattern = (k: number, n: number): boolean[] => {
      const key = `${k}/${n}`;
      let p = cache.get(key);
      if (!p) cache.set(key, (p = bjorklund(k, n)));
      return p;
    };

    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const voices = ph.end.length;
        const trig = outputs.control('trig', voices);
        const gate = outputs.control('gate', voices);
        for (let v = 0; v < voices; v++) {
          const a = ph.start[v]!;
          const steps = ctx.discrete('steps', Math.floor(a), v);
          for (const hit of stepCrossings(a, ph.end[v]!, steps, ctx.t0, ctx.t1, ctx.param('swing', v))) {
            const k = ctx.discrete('pulses', hit.step, v);
            const rot = ctx.discrete('rotate', hit.step, v);
            const idx = mod(hit.step - rot, steps);
            let on = pattern(k, steps)[idx] ?? false;
            let vel = 1;
            if (ctx.rng.chance(ctx.param('mutation', v) * 0.5)) {
              on = !on;
              vel = 0.5; // ciò che nasce dalla mutazione entra come ghost
            }
            s.level[v] = on ? 1 : 0;
            if (on) trig.events.push({ kind: 'trig', t: hit.t, voice: v, vel });
          }
          trig.values[v] = s.level[v] ?? 0;
          gate.values[v] = s.level[v] ?? 0;
        }
      },
      getState: () => ({ level: [...s.level] }),
      setState(state) {
        s = { level: [...(state as EuclidState).level] };
      },
    };
  },
};
