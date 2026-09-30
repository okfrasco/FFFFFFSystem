/**
 * Fa girare una patch con i moduli veri per N battute (120 BPM, 4/4, tick 5 ms:
 * una battuta = 2 s = 400 tick) e raccoglie eventi e valori delle uscite scelte.
 */

import { Graph } from '../../src/core/graph';
import { createRegistry } from '../../src/core/registry';
import type {
  ControlBuffer,
  ControlEvent,
  ModuleDefinition,
  PatchConnection,
  PatchNode,
  PhaseBuffer,
} from '../../src/core/types';
import { moduleRegistry } from '../../src/modules/registry';

export const TICK = 0.005;
export const BAR = 2; // secondi per battuta a 120 BPM in 4/4

export interface ScriptConfig {
  events: ControlEvent[];
  voices?: number;
  /** Livello per voce 0: coppie [tempo, valore], tenute fino alla successiva. */
  levels?: [number, number][];
}

/** Emette gli eventi scritti in config nel tick che li contiene. */
export const script: ModuleDefinition = {
  manifest: {
    id: 'script', name: 'Script', category: 'io', rate: 'control',
    inputs: [],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [],
    seeded: false,
  },
  create(init) {
    const cfg = init.config as ScriptConfig;
    const events = [...cfg.events].sort((a, b) => a.t - b.t);
    return {
      process(ctx, _i, o) {
        const out = o.control('out', cfg.voices ?? 1);
        for (const e of events) if (e.t >= ctx.t0 && e.t < ctx.t1) out.events.push({ ...e });
        let level = 0;
        for (const [t, x] of cfg.levels ?? []) if (t < ctx.t1) level = x;
        out.values[0] = level;
      },
      getState: () => null,
      setState: () => {},
    };
  },
};

export const testRegistry = createRegistry([...moduleRegistry.values(), script]);

export const TRANSPORT: PatchNode = { id: 'tr', module: 'transport', params: { bpm: 120, meter: 4 } };

export interface Sim {
  graph: Graph;
  /** Esegue fino alla battuta indicata (assoluta), chiamando `before` a ogni tick. */
  runTo(bar: number, before?: (t0: number) => void): void;
  events(endpoint: string): ControlEvent[];
  values(endpoint: string): number[][];
  phases(endpoint: string): { start: number[]; end: number[] }[];
}

export function simulate(
  nodes: PatchNode[],
  connections: PatchConnection[],
  collect: string[],
  seed = 1,
): Sim {
  const graph = Graph.build({ version: 1, seed, nodes, connections }, testRegistry);
  const ev = new Map<string, ControlEvent[]>(collect.map((c) => [c, []]));
  const vals = new Map<string, number[][]>(collect.map((c) => [c, []]));
  const phs = new Map<string, { start: number[]; end: number[] }[]>(collect.map((c) => [c, []]));
  let k = 0;
  return {
    graph,
    runTo(bar, before) {
      const until = Math.round((bar * BAR) / TICK);
      for (; k < until; k++) {
        const t0 = k * TICK;
        before?.(t0);
        graph.process(t0, (k + 1) * TICK);
        for (const c of collect) {
          const [node, port] = c.split('.') as [string, string];
          const buf = graph.output(node, port);
          if (buf.type === 'control') {
            for (const e of (buf as ControlBuffer).events) ev.get(c)!.push({ ...e });
            vals.get(c)!.push(Array.from(buf.values));
          } else if (buf.type === 'phase') {
            const p = buf as PhaseBuffer;
            phs.get(c)!.push({ start: Array.from(p.start), end: Array.from(p.end) });
          }
        }
      }
    },
    events: (c) => ev.get(c) ?? [],
    values: (c) => vals.get(c) ?? [],
    phases: (c) => phs.get(c) ?? [],
  };
}

/** Posizione in step (a `steps` per battuta) di un tempo, arrotondata a 1e-6. */
export const stepOf = (t: number, steps = 16): number => Math.round((t / BAR) * steps * 1e6) / 1e6;

/** Rappresentazione compatta per gli snapshot. */
export function compact(events: ControlEvent[], steps = 16): string[] {
  return events.map((e) => {
    const pos = stepOf(e.t, steps).toFixed(3);
    if (e.kind === 'note') return `${pos} v${e.voice} n${e.pitch} ${e.vel.toFixed(2)}`;
    if (e.kind === 'trig') return `${pos} v${e.voice} ${e.value ?? '-'} ${e.vel.toFixed(2)}`;
    return `${pos} v${e.voice} gate ${e.on}`;
  });
}

/** Velocity di un evento (un gate vale 1 se si apre). */
export const vel = (e: ControlEvent): number => (e.kind === 'gate' ? (e.on ? 1 : 0) : e.vel);
