/**
 * Edge — contorni e linee con Sobel o Laplacian.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const edge: ModuleDefinition = {
  manifest: {
    id: 'edge',
    name: 'Edge',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['Sobel', 'Laplacian', 'Frei-Chen'] },
      { id: 'threshold', label: 'Soglia', min: 0, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'strength', label: 'Forza', min: 0.5, max: 5, default: 1, kind: 'continuous' },
      { id: 'invert', label: 'Inverti', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'overlay', label: 'Sovrapponi', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0, kind: 'continuous' },
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
            uMode: ctx.discrete('mode', 0),
            uThreshold: ctx.param('threshold'),
            uStrength: ctx.param('strength'),
            uInvert: ctx.discrete('invert', 0),
            uOverlay: ctx.param('overlay'),
            uHue: ctx.param('hue'),
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

export default edge;
