/**
 * Particelle — sistema di particelle guidate da forze e campi.
 * Emissione continua o a burst con la fase, gravità, attrito e rumore.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const particles: ModuleDefinition = {
  manifest: {
    id: 'particles',
    name: 'Particelle',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'count', label: 'Quantità', min: 50, max: 2000, default: 500, kind: 'discrete' },
      { id: 'size', label: 'Dimensione', min: 1, max: 20, default: 3, kind: 'continuous' },
      { id: 'speed', label: 'Velocità', min: 0.1, max: 3, default: 1, kind: 'continuous' },
      { id: 'life', label: 'Vita', min: 0.5, max: 5, default: 2, kind: 'continuous' },
      { id: 'gravity', label: 'Gravità', min: -1, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'friction', label: 'Attrito', min: 0, max: 0.1, default: 0.02, kind: 'continuous' },
      { id: 'noise', label: 'Rumore', min: 0, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'spread', label: 'Apertura', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'emitMode', label: 'Emissione', min: 0, max: 2, default: 0, kind: 'discrete', options: ['continua', 'burst', 'anello'] },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'fade', label: 'Scia', min: 0, max: 0.98, default: 0.9, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    let prevTarget: Target | null = null;
    const seed = init.seed;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          target = null;
          prevTarget = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          deleteTarget(gl, prevTarget);
          target = createTarget(gl, size.width, size.height);
          prevTarget = createTarget(gl, size.width, size.height);
        }
        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.25;

        // Swap targets
        const tmp = target;
        target = prevTarget;
        prevTarget = tmp;

        pass!.draw(
          target,
          {
            uTime: ctx.t1,
            uPhase: phase,
            uCount: ctx.discrete('count', 0),
            uSize: ctx.param('size'),
            uSpeed: ctx.param('speed'),
            uLife: ctx.param('life'),
            uGravity: ctx.param('gravity'),
            uFriction: ctx.param('friction'),
            uNoise: ctx.param('noise'),
            uSpread: ctx.param('spread'),
            uEmitMode: ctx.discrete('emitMode', 0),
            uHue: ctx.param('hue'),
            uFade: ctx.param('fade'),
            uSeed: seed,
            uDt: ctx.dt,
          },
          { uPrev: prevTarget!.tex },
        );
        const out = outputs.texture('out');
        out.handle = target!.tex;
        out.width = target!.width;
        out.height = target!.height;
      },
      dispose() {
        if (gl) {
          deleteTarget(gl, target);
          deleteTarget(gl, prevTarget);
          pass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default particles;
