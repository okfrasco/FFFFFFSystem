/**
 * Composite — metodi di fusione tra texture.
 * Blend modes come Photoshop: normale, moltiplica, schermo, overlay, ecc.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const composite: ModuleDefinition = {
  manifest: {
    id: 'composite',
    name: 'Composite',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'a', type: 'texture' },
      { id: 'b', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 9, default: 0, kind: 'discrete',
        options: ['normale', 'moltiplica', 'schermo', 'overlay', 'scurisci', 'schiarisci', 'differenza', 'somma', 'sottrai', 'dividi'] },
      { id: 'opacity', label: 'Opacità B', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'swap', label: 'Scambia', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
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

        const swap = ctx.discrete('swap', 0) > 0.5;
        const texA = (inputs.texture(swap ? 'b' : 'a')?.handle as WebGLTexture | null) ?? null;
        const texB = (inputs.texture(swap ? 'a' : 'b')?.handle as WebGLTexture | null) ?? null;

        pass!.draw(
          target,
          {
            uMode: ctx.discrete('mode', 0),
            uOpacity: ctx.param('opacity'),
          },
          { uA: texA, uB: texB },
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

export default composite;
