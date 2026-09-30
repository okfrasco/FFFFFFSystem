/**
 * Ponte controllo → audio (interno, non compare nel menu). Nell'AudioWorklet
 * sostituisce una sorgente di controllo che sta nel main thread: il main
 * manda i buffer di ogni tick in anticipo (lookahead) e il ponte li consegna
 * ai blocchi audio che li contengono, con gli eventi al loro istante.
 * Un evento arrivato in ritardo esce subito, all'inizio del blocco.
 * Un evento può cadere prima dell'inizio del suo pacchetto (i nodi del groove
 * anticipano i colpi fino a 60 ms): esce comunque al suo istante.
 */

import type { ControlEvent, ModuleDefinition } from '../../core/types';

export interface BridgePacket {
  t0: number;
  t1: number;
  values: number[];
  events: ControlEvent[];
}

interface Queued extends BridgePacket {
  next: number; // primo evento non ancora consegnato
}

/** Code dei pacchetti per chiave ("nodo.porta" della sorgente nel main). */
const queues = new Map<string, Queued[]>();

export function pushBridgePacket(key: string, p: BridgePacket): void {
  let q = queues.get(key);
  if (!q) queues.set(key, (q = []));
  q.push({ ...p, next: 0 });
}

export function clearBridges(): void {
  queues.clear();
}

export interface BridgeConfig {
  key: string;
}

export const bridge: ModuleDefinition = {
  manifest: {
    id: 'bridge',
    name: 'Ponte',
    category: 'io',
    rate: 'audio',
    inputs: [],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [],
    seeded: false,
  },
  create(init) {
    let key = (init.config as BridgeConfig).key;
    let last: number[] = [0];
    return {
      process(ctx, _inputs, outputs) {
        const q = queues.get(key) ?? [];
        const events: ControlEvent[] = [];
        // pacchetti finiti: consegna ciò che resta e tieni i loro valori
        while (q.length && q[0]!.t1 <= ctx.t0) {
          const p = q.shift()!;
          for (let i = p.next; i < p.events.length; i++) events.push({ ...p.events[i]!, t: ctx.t0 });
          last = p.values;
        }
        for (const p of q) {
          if (p.t0 <= ctx.t0) last = p.values;
          // niente uscita anticipata al primo pacchetto futuro: può contenere eventi anticipati
          while (p.next < p.events.length && p.events[p.next]!.t < ctx.t1) {
            const e = p.events[p.next++]!;
            events.push(e.t < ctx.t0 ? { ...e, t: ctx.t0 } : e);
          }
        }
        events.sort((a, b) => a.t - b.t);
        const out = outputs.control('out', Math.max(1, last.length));
        for (let v = 0; v < out.values.length; v++) out.values[v] = last[v] ?? 0;
        for (const e of events) out.events.push(e);
      },
      setConfig(config) {
        key = (config as BridgeConfig).key;
      },
      getState: () => null,
      setState() {},
    };
  },
};
