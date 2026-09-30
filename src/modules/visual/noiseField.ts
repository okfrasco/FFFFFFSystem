/**
 * Noise field — fbm di simplex con domain warping. Il tempo del rumore è la
 * fase in ingresso × `speed`: con la battuta collegata l'immagine evolve a
 * tempo con la musica (e si ferma se la musica si ferma).
 */

import noiseFrag from '../../shaders/noise.frag?raw';
import type { ModuleDefinition } from '../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../visual/gl';

export const noiseField: ModuleDefinition = {
  manifest: {
    id: 'noiseField',
    name: 'Noise field',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'scale', label: 'Scala', min: 0.2, max: 20, default: 3, kind: 'continuous', curve: 'exp' },
      { id: 'speed', label: 'Velocità', min: 0, max: 4, default: 0.5, kind: 'continuous' },
      { id: 'octaves', label: 'Ottave', min: 1, max: 8, default: 4, kind: 'discrete' },
      { id: 'warp', label: 'Warp', min: 0, max: 3, default: 0.8, kind: 'continuous' },
      { id: 'contrast', label: 'Contrasto', min: 0.2, max: 4, default: 1.2, kind: 'continuous', curve: 'exp' },
      { id: 'color', label: 'Colore', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    const seedOffset = ((init.seed % 997) / 997) * 100;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, noiseFrag);
          target = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
        }
        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.5;
        pass!.draw(target, {
          uTime: (phase * ctx.param('speed')) % 1000,
          uScale: ctx.param('scale'),
          uOctaves: ctx.param('octaves'),
          uWarp: ctx.param('warp'),
          uContrast: ctx.param('contrast'),
          uColor: ctx.param('color'),
          uSeed: seedOffset,
        });
        const out = outputs.texture('out');
        out.handle = target.tex;
        out.width = target.width;
        out.height = target.height;
      },
      dispose() {
        if (gl) {
          deleteTarget(gl, target);
          pass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};
