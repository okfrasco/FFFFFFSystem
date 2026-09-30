/**
 * Mask — una texture ritaglia un'altra.
 * La maschera può usare luminosità, canale alpha o un canale specifico.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const mask: ModuleDefinition = {
  manifest: {
    id: 'mask',
    name: 'Mask',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'mask', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'channel', label: 'Canale', min: 0, max: 3, default: 0, kind: 'discrete', options: ['luminosità', 'rosso', 'verde', 'blu'] },
      { id: 'invert', label: 'Inverti', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'threshold', label: 'Soglia', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'softness', label: 'Morbidezza', min: 0, max: 0.5, default: 0.1, kind: 'continuous' },
      { id: 'multiply', label: 'Moltiplica', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
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
            uChannel: ctx.discrete('channel', 0),
            uInvert: ctx.discrete('invert', 0),
            uThreshold: ctx.param('threshold'),
            uSoftness: ctx.param('softness'),
            uMultiply: ctx.discrete('multiply', 0),
          },
          {
            uIn: (inputs.texture('in')?.handle as WebGLTexture | null) ?? null,
            uMask: (inputs.texture('mask')?.handle as WebGLTexture | null) ?? null,
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

export default mask;
