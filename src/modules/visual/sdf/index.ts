/**
 * SDF — forme 2D e 3D con signed distance functions in raymarching.
 * Forme combinabili: unione, intersezione, differenza, smooth blend.
 * La fase anima posizione e rotazione dell'oggetto.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const sdf: ModuleDefinition = {
  manifest: {
    id: 'sdf',
    name: 'SDF',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'shape', label: 'Forma', min: 0, max: 5, default: 0, kind: 'discrete', options: ['sfera', 'cubo', 'toro', 'capsula', 'ottaedro', 'gyroid'] },
      { id: 'combine', label: 'Combina', min: 0, max: 3, default: 0, kind: 'discrete', options: ['unione', 'intersezione', 'differenza', 'smooth'] },
      { id: 'size', label: 'Dimensione', min: 0.1, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'round', label: 'Smussatura', min: 0, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'repeat', label: 'Ripetizione', min: 0, max: 4, default: 0, kind: 'continuous' },
      { id: 'twist', label: 'Torsione', min: 0, max: 4, default: 0, kind: 'continuous' },
      { id: 'rotSpeed', label: 'Rotazione', min: 0, max: 2, default: 0.25, kind: 'continuous' },
      { id: 'camDist', label: 'Distanza cam', min: 2, max: 10, default: 4, kind: 'continuous' },
      { id: 'ambient', label: 'Ambiente', min: 0, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'specular', label: 'Speculare', min: 0, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.6, kind: 'continuous' },
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
          uTime: phase * ctx.param('rotSpeed'),
          uShape: ctx.discrete('shape', 0),
          uCombine: ctx.discrete('combine', 0),
          uSize: ctx.param('size'),
          uRound: ctx.param('round'),
          uRepeat: ctx.param('repeat'),
          uTwist: ctx.param('twist'),
          uCamDist: ctx.param('camDist'),
          uAmbient: ctx.param('ambient'),
          uSpecular: ctx.param('specular'),
          uHue: ctx.param('hue'),
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

export default sdf;
