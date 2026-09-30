/**
 * Tipografia — testo come forma o maschera.
 * Caratteri disegnati con SDF per scalabilità.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const typography: ModuleDefinition = {
  manifest: {
    id: 'typography',
    name: 'Tipografia',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'char', label: 'Carattere', min: 0, max: 9, default: 0, kind: 'discrete', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      { id: 'size', label: 'Dimensione', min: 0.1, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'thickness', label: 'Spessore', min: 0.01, max: 0.2, default: 0.05, kind: 'continuous' },
      { id: 'blur', label: 'Sfocatura', min: 0, max: 0.1, default: 0.01, kind: 'continuous' },
      { id: 'offsetX', label: 'Sposta X', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'offsetY', label: 'Sposta Y', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'invert', label: 'Inverti', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
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

        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.25;
        const charIdx = ctx.discrete('char', 0);

        pass!.draw(target, {
          uChar: charIdx,
          uSize: ctx.param('size'),
          uThickness: ctx.param('thickness'),
          uBlur: ctx.param('blur'),
          uOffset: [ctx.param('offsetX'), ctx.param('offsetY')],
          uRotate: ctx.param('rotate') * Math.PI * 2,
          uHue: ctx.param('hue'),
          uInvert: ctx.discrete('invert', 0),
          uPhase: phase,
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

export default typography;
