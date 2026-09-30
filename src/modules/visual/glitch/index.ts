/**
 * Glitch — datamosh, pixel sort, slit-scan, RGB shift.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const glitch: ModuleDefinition = {
  manifest: {
    id: 'glitch',
    name: 'Glitch',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 3, default: 0, kind: 'discrete', options: ['RGB shift', 'scanlines', 'blocchi', 'wave'] },
      { id: 'amount', label: 'Quantità', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'speed', label: 'Velocità', min: 0, max: 4, default: 1, kind: 'continuous' },
      { id: 'blockSize', label: 'Dimensione', min: 2, max: 64, default: 16, kind: 'discrete' },
      { id: 'rgbSplit', label: 'Separazione RGB', min: 0, max: 0.1, default: 0.02, kind: 'continuous' },
      { id: 'noise', label: 'Rumore', min: 0, max: 1, default: 0.1, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    const seed = init.seed;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          target = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
        }

        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.25;

        pass!.draw(
          target,
          {
            uTime: ctx.t1,
            uPhase: phase * ctx.param('speed'),
            uMode: ctx.discrete('mode', 0),
            uAmount: ctx.param('amount'),
            uBlockSize: ctx.discrete('blockSize', 0),
            uRgbSplit: ctx.param('rgbSplit'),
            uNoise: ctx.param('noise'),
            uSeed: seed,
          },
          { uIn: (inputs.texture('in')?.handle as WebGLTexture | null) ?? null },
        );

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

export default glitch;
