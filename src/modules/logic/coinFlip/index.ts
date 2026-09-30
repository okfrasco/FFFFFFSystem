/**
 * Coin Flip — smista ogni colpo verso A (con probabilità `prob`) o verso B.
 * Il fronte di chiusura di un gate segue sempre la stessa uscita
 * dell'apertura, così nessun gate resta appeso.
 */

import type { ModuleDefinition } from '../../../core/types';

interface CoinState {
  route: number[]; // per voce: 0 = A, 1 = B
}

export const coinFlip: ModuleDefinition = {
  manifest: {
    id: 'coinFlip',
    name: 'Coin Flip',
    category: 'logic',
    rate: 'control',
    inputs: [{ id: 'trig', type: 'control', signal: 'event', poly: true }],
    outputs: [
      { id: 'a', type: 'control', signal: 'event', poly: true },
      { id: 'b', type: 'control', signal: 'event', poly: true },
    ],
    params: [{ id: 'prob', label: 'Probabilità A', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
    seeded: true,
  },

  create() {
    let s: CoinState = { route: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.control('trig');
        if (!input) return;
        const voices = input.values.length;
        const outs = [outputs.control('a', voices), outputs.control('b', voices)] as const;
        for (const e of input.events) {
          const v = e.voice;
          if (!(e.kind === 'gate' && !e.on)) s.route[v] = ctx.rng.chance(ctx.param('prob', v)) ? 0 : 1;
          outs[(s.route[v] ?? 0) as 0 | 1].events.push({ ...e });
        }
        for (let v = 0; v < voices; v++) {
          outs[0].values[v] = s.route[v] === 0 ? 1 : 0;
          outs[1].values[v] = s.route[v] === 1 ? 1 : 0;
        }
      },
      getState: () => ({ route: [...s.route] }),
      setState(state) {
        s = { route: [...(state as CoinState).route] };
      },
    };
  },
};

export default coinFlip;
