/**
 * Pan — porta un segnale nello stereo (2 voci). Un segnale a più voci viene
 * aperto a ventaglio: `spread` distribuisce le voci da sinistra a destra
 * attorno a `pan` (le voci di Voci diventano un accordo largo). Un segnale già
 * stereo viene bilanciato con `pan` e allargato o stretto con `width`
 * (0 = mono, 1 = com'è, 2 = più largo). Legge del pan a potenza costante.
 */

import type { ModuleDefinition } from '../../../core/types';

/** Guadagni sinistro e destro (potenza costante) per una posizione −1…1. */
export function panGains(p: number): [number, number] {
  const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Posizione della voce v di n con pan e spread. */
export const voicePos = (v: number, n: number, pan: number, spread: number) => pan + (n > 1 ? ((v / (n - 1)) * 2 - 1) * spread : 0);

export const pan: ModuleDefinition = {
  manifest: {
    id: 'pan',
    name: 'Pan',
    category: 'effects',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'pan', label: 'Pan', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'spread', label: 'Apertura voci', min: 0, max: 1, default: 0.7, kind: 'continuous' },
      { id: 'width', label: 'Larghezza stereo', min: 0, max: 2, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const out = outputs.audio('out', 2).channels;
        const L = out[0]!;
        const R = out[1]!;
        L.fill(0);
        R.fill(0);
        if (!input) return;
        const n = input.channels.length;
        const p = ctx.param('pan');
        if (n === 2) {
          const width = ctx.param('width');
          const [gl, gr] = panGains(p);
          const a = input.channels[0]!;
          const b = input.channels[1]!;
          for (let i = 0; i < ctx.frames; i++) {
            const mid = (a[i]! + b[i]!) * 0.5;
            const side = (a[i]! - b[i]!) * 0.5 * width;
            L[i] = (mid + side) * gl * Math.SQRT2;
            R[i] = (mid - side) * gr * Math.SQRT2;
          }
          return;
        }
        const spread = ctx.param('spread');
        for (let v = 0; v < n; v++) {
          const [gl, gr] = panGains(voicePos(v, n, p, spread));
          const x = input.channels[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            L[i]! += x[i]! * gl;
            R[i]! += x[i]! * gr;
          }
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default pan;
