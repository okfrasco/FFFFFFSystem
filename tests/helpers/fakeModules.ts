/** Moduli minimi per testare il grafo senza dipendere dai nodi veri. */

import { createRegistry } from '../../src/core/registry';
import type { ModuleDefinition, ModuleInstance } from '../../src/core/types';

/** Ordine in cui i nodi sono stati processati (azzerare nei beforeEach). */
export const processLog: string[] = [];

const stateless = (process: ModuleInstance['process']): ModuleInstance => ({
  process,
  getState: () => null,
  setState: () => {},
});

/** Valore costante (param `value`) su N voci (param `voices`). */
export const constant: ModuleDefinition = {
  manifest: {
    id: 'constant', name: 'Constant', category: 'transform', rate: 'control',
    inputs: [],
    outputs: [{ id: 'out', type: 'control', poly: true }],
    params: [
      { id: 'value', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'voices', min: 1, max: 8, default: 1, kind: 'discrete' },
    ],
    seeded: false,
  },
  create: () =>
    stateless((ctx, _i, o) => {
      const n = ctx.param('voices');
      const out = o.control('out', n);
      for (let v = 0; v < n; v++) out.values[v] = ctx.param('value') * (v + 1);
    }),
};

/** out = in + 1, registra il proprio id nel processLog. */
export const inc: ModuleDefinition = {
  manifest: {
    id: 'inc', name: 'Inc', category: 'transform', rate: 'control',
    inputs: [{ id: 'in', type: 'control' }],
    outputs: [{ id: 'out', type: 'control' }],
    params: [{ id: 'gain', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
    seeded: false,
  },
  create: (init) => {
    const name = (init.config as { name?: string } | null)?.name ?? '?';
    return stateless((_c, i, o) => {
      processLog.push(name);
      o.control('out').values[0] = (i.control('in')?.values[0] ?? 0) + 1;
    });
  },
};

/** Un trigger a ogni tick, a t0 + offset (param). */
export const ticker: ModuleDefinition = {
  manifest: {
    id: 'ticker', name: 'Ticker', category: 'generators', rate: 'control',
    inputs: [],
    outputs: [{ id: 'trig', type: 'control', signal: 'event' }],
    params: [{ id: 'offset', min: 0, max: 1, default: 0, kind: 'continuous' }],
    seeded: true,
  },
  create: () =>
    stateless((ctx, _i, o) => {
      const out = o.control('trig');
      out.values[0] = 1;
      out.events.push({ kind: 'trig', t: ctx.t0 + ctx.param('offset') * ctx.dt, voice: 0, vel: ctx.rng.float() });
    }),
};

/** Ingresso di tipo gate, uscita di fase; copia ciò che vede. */
export const gateSink: ModuleDefinition = {
  manifest: {
    id: 'gateSink', name: 'Gate Sink', category: 'logic', rate: 'control',
    inputs: [{ id: 'g', type: 'control', signal: 'gate' }, { id: 'ph', type: 'phase' }],
    outputs: [{ id: 'seen', type: 'control', signal: 'event' }, { id: 'ph', type: 'phase' }],
    params: [],
    seeded: false,
  },
  create: () =>
    stateless((_c, i, o) => {
      const out = o.control('seen');
      for (const e of i.control('g')?.events ?? []) out.events.push(e);
    }),
};

/** Nodo a frame rate: non deve girare nei tick di controllo. */
export const frameNode: ModuleDefinition = {
  manifest: {
    id: 'frameNode', name: 'Frame', category: 'visual', rate: 'frame',
    inputs: [{ id: 'in', type: 'control' }],
    outputs: [{ id: 'tex', type: 'texture' }],
    params: [],
    seeded: false,
  },
  create: () => stateless(() => processLog.push('frame')),
};

/** Espone il suo RNG e i param discreti per i test su seed e config. */
export const probe: ModuleDefinition = {
  manifest: {
    id: 'probe', name: 'Probe', category: 'generators', rate: 'control',
    inputs: [],
    outputs: [{ id: 'out', type: 'control' }],
    params: [{ id: 'mode', min: 0, max: 2, default: 0, kind: 'discrete', options: ['a', 'b', 'c'] }],
    seeded: true,
  },
  defaultConfig: { table: [1, 2, 3] },
  create: () =>
    stateless((ctx, _i, o) => {
      o.control('out').values[0] = ctx.rng.float();
    }),
};

export const fakeRegistry = createRegistry([constant, inc, ticker, gateSink, frameNode, probe]);
