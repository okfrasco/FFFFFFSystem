/**
 * Displace — sposta i pixel secondo un'altra texture.
 * La texture di spostamento usa R per X e G per Y.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const displace: ModuleDefinition = {
  manifest: {
    id: 'displace',
    name: 'Displace',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'map', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'amount', label: 'Quantità', min: 0, max: 0.5, default: 0.1, kind: 'continuous' },
      { id: 'scaleX', label: 'Scala X', min: 0, max: 2, default: 1, kind: 'continuous' },
      { id: 'scaleY', label: 'Scala Y', min: 0, max: 2, default: 1, kind: 'continuous' },
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['RG', 'luminosità', 'angolare'] },
      { id: 'wrap', label: 'Bordi', min: 0, max: 1, default: 1, kind: 'discrete', options: ['clamp', 'wrap'] },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
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

        pass!.draw(
          target,
          {
            uAmount: ctx.param('amount'),
            uScaleX: ctx.param('scaleX'),
            uScaleY: ctx.param('scaleY'),
            uMode: ctx.discrete('mode', 0),
            uWrap: ctx.discrete('wrap', 0),
          },
          {
            uIn: (inputs.texture('in')?.handle as WebGLTexture | null) ?? null,
            uMap: (inputs.texture('map')?.handle as WebGLTexture | null) ?? null,
          },
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

export default displace;
