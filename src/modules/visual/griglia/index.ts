/**
 * Pattern — griglie, ripetizioni e moiré. Produce texture geometriche
 * con cerchi, linee, onde e griglie sovrapposte.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const griglia: ModuleDefinition = {
  manifest: {
    id: 'griglia',
    name: 'Griglia',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'type', label: 'Tipo', min: 0, max: 5, default: 0, kind: 'discrete', options: ['cerchi', 'linee', 'griglia', 'onde', 'esagoni', 'voronoi'] },
      { id: 'scale', label: 'Scala', min: 1, max: 50, default: 10, kind: 'continuous', curve: 'exp' },
      { id: 'thickness', label: 'Spessore', min: 0.01, max: 0.5, default: 0.1, kind: 'continuous' },
      { id: 'speed', label: 'Velocità', min: 0, max: 4, default: 0.5, kind: 'continuous' },
      { id: 'layers', label: 'Strati', min: 1, max: 4, default: 1, kind: 'discrete' },
      { id: 'angleOffset', label: 'Angolo 2', min: 0, max: 90, default: 30, kind: 'continuous' },
      { id: 'distort', label: 'Distorsione', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'saturation', label: 'Saturazione', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    const seedOffset = (init.seed % 997) / 997;
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
        pass!.draw(target, {
          uTime: phase * ctx.param('speed'),
          uType: ctx.discrete('type', 0),
          uScale: ctx.param('scale'),
          uThickness: ctx.param('thickness'),
          uLayers: ctx.discrete('layers', 0),
          uAngleOffset: ctx.param('angleOffset') * Math.PI / 180,
          uDistort: ctx.param('distort'),
          uHue: ctx.param('hue'),
          uSaturation: ctx.param('saturation'),
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

export default griglia;
