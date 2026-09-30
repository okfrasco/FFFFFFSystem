/**
 * Router — manda ogni evento a una delle uscite (fino a 4): a turno, a caso,
 * o avanti e indietro. Se l'ingresso `advance` è collegato, l'uscita cambia
 * a ogni suo colpo invece che a ogni evento.
 */

import { eventsOf, isOn } from '../../../core/signals';
import type { ControlEvent, ModuleDefinition } from '../../../core/types';

interface RouterState {
  index: number;
  dir: number;
  /** Dove è andata l'ultima apertura di gate di ogni voce: la chiusura la segue. */
  gateRoute: number[];
}

export const router: ModuleDefinition = {
  manifest: {
    id: 'router',
    name: 'Router',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'in', type: 'control', signal: 'event', poly: true },
      { id: 'advance', type: 'control', signal: 'event' },
    ],
    outputs: [1, 2, 3, 4].map((k) => ({ id: `out${k}`, type: 'control' as const, signal: 'event' as const, poly: true })),
    params: [
      { id: 'count', label: 'Uscite', min: 2, max: 4, default: 4, kind: 'discrete' },
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['a turno', 'caso', 'avanti e indietro'] },
    ],
    seeded: true,
  },
  create() {
    let s: RouterState = { index: 0, dir: 1, gateRoute: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('in');
        const adv = inputs.control('advance');
        const voices = input?.values.length ?? 1;
        const outs = [1, 2, 3, 4].map((k) => outputs.control(`out${k}`, voices));
        const N = ctx.discrete('count', ctx.tick);
        const step = () => {
          const mode = ctx.discrete('mode', ctx.tick);
          if (mode === 1) s.index = ctx.rng.int(0, N);
          else if (mode === 2) {
            if (s.index + s.dir < 0 || s.index + s.dir >= N) s.dir = -s.dir;
            s.index += s.dir;
          } else s.index = (s.index + 1) % N;
        };
        const items: { t: number; adv: boolean; e?: ControlEvent }[] = [
          ...(input?.events ?? []).map((e) => ({ t: e.t, adv: false, e })),
          ...eventsOf(adv, 0).filter(isOn).map((e) => ({ t: e.t, adv: true })),
        ].sort((a, b) => a.t - b.t || (a.adv ? -1 : 1));
        for (const it of items) {
          if (it.adv) {
            step();
            continue;
          }
          const e = it.e!;
          if (e.kind === 'gate' && !e.on) {
            outs[s.gateRoute[e.voice] ?? s.index]!.events.push({ ...e });
            continue;
          }
          s.index = Math.min(s.index, N - 1);
          if (e.kind === 'gate') s.gateRoute[e.voice] = s.index;
          outs[s.index]!.events.push({ ...e });
          // senza `advance` si passa alla prossima uscita dopo ogni accensione
          if (!adv) step();
        }
        outs.forEach((o, k) => (o.values[0] = k === s.index ? 1 : 0));
      },
      getState: () => ({ ...s, gateRoute: [...s.gateRoute] }),
      setState(state) {
        const st = state as RouterState;
        s = { index: st.index, dir: st.dir, gateRoute: [...(st.gateRoute ?? [])] };
      },
    };
  },
};

export default router;
