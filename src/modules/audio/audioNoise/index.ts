/**
 * Noise (audio) — rumore bianco, rosa (−3 dB/ottava), marrone (−6 dB/ottava),
 * crackle (impulsi sparsi di ampiezza casuale, `density` al secondo) e
 * velvet (impulsi ±1 su una griglia, più liscio del bianco). Con `stereo`
 * esce su due voci indipendenti.
 */

import type { ModuleDefinition } from '../../../core/types';

export const COLORS = ['bianco', 'rosa', 'marrone', 'crackle', 'velvet'] as const;

interface Pink {
  b: number[];
  brown: number;
}

export const audioNoise: ModuleDefinition = {
  manifest: {
    id: 'audioNoise',
    name: 'Noise (audio)',
    category: 'audio',
    rate: 'audio',
    inputs: [],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'color', label: 'Colore', min: 0, max: COLORS.length - 1, default: 0, kind: 'discrete', options: [...COLORS] },
      { id: 'density', label: 'Densità', min: 1, max: 5000, default: 200, kind: 'continuous', curve: 'exp', unit: '/s' },
      { id: 'stereo', label: 'Stereo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const st: Pink[] = [];
    return {
      process(ctx, _inputs, outputs) {
        const n = ctx.discrete('stereo', 0) === 1 ? 2 : 1;
        const out = outputs.audio('out', n).channels;
        while (st.length < n) st.push({ b: [0, 0, 0, 0, 0, 0, 0], brown: 0 });
        const color = ctx.discrete('color', 0);
        const level = ctx.param('level');
        const rate = ctx.param('density') / ctx.sampleRate;
        const rng = ctx.rng;
        for (let v = 0; v < n; v++) {
          const o = out[v]!;
          const s = st[v]!;
          const b = s.b;
          for (let i = 0; i < ctx.frames; i++) {
            const w = rng.float() * 2 - 1;
            let y: number;
            switch (color) {
              case 1:
                // filtro di Paul Kellet
                b[0] = 0.99886 * b[0]! + w * 0.0555179;
                b[1] = 0.99332 * b[1]! + w * 0.0750759;
                b[2] = 0.969 * b[2]! + w * 0.153852;
                b[3] = 0.8665 * b[3]! + w * 0.3104856;
                b[4] = 0.55 * b[4]! + w * 0.5329522;
                b[5] = -0.7616 * b[5]! - w * 0.016898;
                y = (b[0]! + b[1]! + b[2]! + b[3]! + b[4]! + b[5]! + b[6]! + w * 0.5362) * 0.11;
                b[6] = w * 0.115926;
                break;
              case 2:
                s.brown = (s.brown + 0.02 * w) * 0.998;
                y = s.brown * 3.5;
                break;
              case 3:
                y = rng.float() < rate ? (rng.float() * 2 - 1) : 0;
                break;
              case 4: {
                // un impulso ±1 in una posizione a caso di ogni cella lunga 1/density
                y = rng.float() < rate ? (w < 0 ? -1 : 1) : 0;
                break;
              }
              default:
                y = w;
            }
            o[i] = y * level;
          }
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default audioNoise;
