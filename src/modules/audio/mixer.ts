/**
 * Mixer a 4 ingressi con livello e pan, uscita stereo (2 voci). Un ingresso a
 * 2 voci è trattato come stereo (il pan fa da bilanciamento), uno con più voci
 * viene sommato in mono. Più cavi sullo stesso ingresso si sommano.
 */

import type { ModuleDefinition, ParamSpec } from '../../core/types';

const INPUTS = 4;
const params: ParamSpec[] = [];
for (let k = 1; k <= INPUTS; k++) {
  params.push({ id: `level${k}`, label: `livello ${k}`, min: 0, max: 1.5, default: 0.8, kind: 'continuous' });
  params.push({ id: `pan${k}`, label: `pan ${k}`, min: -1, max: 1, default: 0, kind: 'continuous' });
}
params.push({ id: 'master', label: 'Master', min: 0, max: 1.5, default: 1, kind: 'continuous' });

export const mixer: ModuleDefinition = {
  manifest: {
    id: 'mixer',
    name: 'Mixer',
    category: 'effects',
    rate: 'audio',
    inputs: Array.from({ length: INPUTS }, (_, k) => ({ id: `in${k + 1}`, type: 'audio' as const, poly: true })),
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params,
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const [L, R] = outputs.audio('out', 2).channels as [Float32Array, Float32Array];
        L.fill(0);
        R.fill(0);
        const master = ctx.param('master');
        for (let k = 1; k <= INPUTS; k++) {
          const input = inputs.audio(`in${k}`);
          if (!input) continue;
          const level = ctx.param(`level${k}`) * master;
          const pan = ctx.param(`pan${k}`);
          const angle = ((pan + 1) * Math.PI) / 4;
          const gl = Math.cos(angle) * Math.SQRT2 * level;
          const gr = Math.sin(angle) * Math.SQRT2 * level;
          const chs = input.channels;
          if (chs.length === 2) {
            const a = chs[0]!;
            const b = chs[1]!;
            const bl = Math.min(1, 1 - pan) * level;
            const br = Math.min(1, 1 + pan) * level;
            for (let i = 0; i < ctx.frames; i++) {
              L[i]! += a[i]! * bl;
              R[i]! += b[i]! * br;
            }
          } else {
            for (let i = 0; i < ctx.frames; i++) {
              let x = 0;
              for (const ch of chs) x += ch[i]!;
              L[i]! += x * gl;
              R[i]! += x * gr;
            }
          }
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};
