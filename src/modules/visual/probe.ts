/**
 * Sonde (interne, non nel menu): nel grafo dei visual sostituiscono una
 * sorgente di fase o di controllo del main, leggendone la Timeline
 * all'istante del frame (ctx.t1). Il renderer imposta come trovare le Timeline.
 */

import type { Timeline } from '../../core/timeline';
import type { ModuleDefinition } from '../../core/types';

let resolve: (key: string) => Timeline | undefined = () => undefined;

export function setProbeResolver(fn: (key: string) => Timeline | undefined): void {
  resolve = fn;
}

interface ProbeConfig {
  key: string;
}

export const probePhase: ModuleDefinition = {
  manifest: {
    id: 'probePhase', name: 'Sonda fase', category: 'io', rate: 'frame',
    inputs: [], outputs: [{ id: 'out', type: 'phase' }], params: [], seeded: false,
  },
  create(init) {
    let key = (init.config as ProbeConfig).key;
    return {
      process(ctx, _i, outputs) {
        const tl = resolve(key);
        const out = outputs.phase('out');
        out.start[0] = tl?.size ? tl.sample(ctx.t0) : 0;
        out.end[0] = tl?.size ? tl.sample(ctx.t1) : 0;
      },
      setConfig(c) {
        key = (c as ProbeConfig).key;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export const probeControl: ModuleDefinition = {
  manifest: {
    id: 'probeControl', name: 'Sonda controllo', category: 'io', rate: 'frame',
    inputs: [], outputs: [{ id: 'out', type: 'control', signal: 'event' }], params: [], seeded: false,
  },
  create(init) {
    let key = (init.config as ProbeConfig).key;
    return {
      process(ctx, _i, outputs) {
        const tl = resolve(key);
        outputs.control('out').values[0] = tl?.size ? tl.sample(ctx.t1) : 0;
      },
      setConfig(c) {
        key = (c as ProbeConfig).key;
      },
      getState: () => null,
      setState() {},
    };
  },
};
