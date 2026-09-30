/**
 * Uscita — manda il segnale alla scheda audio. 1 voce = mono su entrambi i
 * canali, 2 voci = sinistra/destra, più voci alternate tra i due lati.
 * L'host legge il suo ingresso; un limitatore morbido (tanh) protegge le casse.
 */

import type { ModuleDefinition } from '../../core/types';

export const output: ModuleDefinition = {
  manifest: {
    id: 'output',
    name: 'Uscita',
    category: 'io',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [],
    params: [{ id: 'volume', label: 'Volume', min: 0, max: 1, default: 0.7, kind: 'continuous' }],
    seeded: false,
  },
  create() {
    return { process() {}, getState: () => null, setState() {} };
  },
};

/** Somma l'ingresso di un nodo Uscita nei canali della scheda (con limitatore alla fine, a cura dell'host). */
export function mixToDevice(channels: readonly Float32Array[], volume: number, dest: Float32Array[]): void {
  const n = channels.length;
  if (n === 0 || dest.length === 0) return;
  const frames = dest[0]!.length;
  for (let v = 0; v < n; v++) {
    const src = channels[v]!;
    const scale = volume / Math.ceil(n / 2);
    const targets = n === 1 ? dest : [dest[v % 2] ?? dest[0]!];
    for (const d of targets) for (let i = 0; i < frames && i < src.length; i++) d[i]! += src[i]! * (n === 1 ? volume : scale);
  }
}
