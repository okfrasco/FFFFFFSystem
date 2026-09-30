/** Grafo audio per i test: sorgenti di eventi a rate audio e render a blocchi. */

import { Graph } from '../../src/core/graph';
import { createRegistry } from '../../src/core/registry';
import type { AudioBlock, ControlEvent, ModuleDefinition, PatchConnection, PatchNode } from '../../src/core/types';
import { audioModules } from '../../src/modules/audioModules';
import { bridge } from '../../src/modules/audio/bridge';

export const SR = 48000;
export const FRAMES = 128;

/** Emette gli eventi della config nel blocco che li contiene (rate audio). */
const eventSource: ModuleDefinition = {
  manifest: {
    id: 'eventSource', name: 'Eventi', category: 'io', rate: 'audio',
    inputs: [], outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }], params: [], seeded: false,
  },
  create(init) {
    const events = (init.config as { events: ControlEvent[] }).events;
    return {
      process(ctx, _i, o) {
        const out = o.control('out');
        for (const e of events) if (e.t >= ctx.t0 && e.t < ctx.t1) out.events.push({ ...e });
      },
      getState: () => null,
      setState: () => {},
    };
  },
};

/** Funzioni dei segnali di prova: la config (JSON) porta solo la chiave. */
const signalFns = new Map<string, { fn: (t: number, v: number) => number; voices?: number }>();
let signalKey = 0;

/** Segnale audio costante o funzione del tempo (rate audio). */
const signalSource: ModuleDefinition = {
  manifest: {
    id: 'signal', name: 'Segnale', category: 'io', rate: 'audio',
    inputs: [], outputs: [{ id: 'out', type: 'audio', poly: true }], params: [], seeded: false,
  },
  create(init) {
    const { fn, voices = 1 } = signalFns.get((init.config as { key: string }).key)!;
    return {
      process(ctx, _i, o) {
        const out = o.audio('out', voices);
        for (let v = 0; v < voices; v++) for (let i = 0; i < ctx.frames; i++) out.channels[v]![i] = fn(ctx.t0 + i / ctx.sampleRate, v);
      },
      getState: () => null,
      setState: () => {},
    };
  },
};

export const audioTestRegistry = createRegistry([...audioModules, bridge, eventSource, signalSource]);

export interface AudioSim {
  graph: Graph;
  /** Esegue `seconds` e restituisce, per ogni uscita richiesta, i canali concatenati. */
  run(seconds: number): Map<string, Float32Array[]>;
}

export function audioSim(nodes: PatchNode[], connections: PatchConnection[], collect: string[], seed = 1): AudioSim {
  const safeNodes = nodes.map((n) => {
    if (n.module !== 'signal') return n;
    const key = `s${signalKey++}`;
    signalFns.set(key, n.config as { fn: (t: number, v: number) => number; voices?: number });
    return { ...n, config: { key } };
  });
  const graph = Graph.build({ version: 1, seed, nodes: safeNodes, connections }, audioTestRegistry, {
    rate: 'audio',
    audio: { sampleRate: SR, frames: FRAMES },
  });
  let block = 0;
  return {
    graph,
    run(seconds) {
      const blocks = Math.ceil((seconds * SR) / FRAMES);
      const acc = new Map<string, Float32Array[][]>(collect.map((c) => [c, []]));
      for (let b = 0; b < blocks; b++, block++) {
        const t0 = (block * FRAMES) / SR;
        graph.process(t0, t0 + FRAMES / SR);
        for (const c of collect) {
          const [node, port] = c.split('.') as [string, string];
          const buf = graph.output(node, port) as AudioBlock;
          acc.get(c)!.push(buf.channels.map((ch) => ch.slice()));
        }
      }
      const out = new Map<string, Float32Array[]>();
      for (const [c, list] of acc) {
        const voices = Math.max(...list.map((l) => l.length));
        out.set(
          c,
          Array.from({ length: voices }, (_, v) => {
            const all = new Float32Array(list.length * FRAMES);
            list.forEach((l, b) => all.set(l[v] ?? new Float32Array(FRAMES), b * FRAMES));
            return all;
          }),
        );
      }
      return out;
    },
  };
}

export const note = (t: number, pitch: number, dur = 0.1, vel = 1): ControlEvent => ({ kind: 'note', t, voice: 0, pitch, vel, dur });
export const trig = (t: number, vel = 1): ControlEvent => ({ kind: 'trig', t, voice: 0, vel });

export const rms = (x: Float32Array, a = 0, b = x.length) => {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
};
export const peak = (x: Float32Array, a = 0, b = x.length) => {
  let p = 0;
  for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i]!));
  return p;
};
/** Primo campione con |x| > soglia. */
export const onset = (x: Float32Array, thr = 1e-3, from = 0) => {
  for (let i = from; i < x.length; i++) if (Math.abs(x[i]!) > thr) return i;
  return -1;
};
