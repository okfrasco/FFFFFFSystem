/**
 * Flow field — linee che seguono un campo vettoriale derivato da rumore.
 * Le linee si muovono a tempo con la fase.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const flowField: ModuleDefinition = {
  manifest: {
    id: 'flowField',
    name: 'Flow field',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'lines', label: 'Linee', min: 50, max: 1000, default: 300, kind: 'discrete' },
      { id: 'length', label: 'Lunghezza', min: 5, max: 100, default: 30, kind: 'discrete' },
      { id: 'thickness', label: 'Spessore', min: 0.5, max: 5, default: 1.5, kind: 'continuous' },
      { id: 'scale', label: 'Scala campo', min: 0.5, max: 10, default: 3, kind: 'continuous', curve: 'exp' },
      { id: 'speed', label: 'Velocità', min: 0, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'curl', label: 'Riccio', min: 0, max: 3, default: 1, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'hueSpread', label: 'Variazione', min: 0, max: 0.5, default: 0.1, kind: 'continuous' },
      { id: 'fade', label: 'Scia', min: 0, max: 0.98, default: 0.95, kind: 'continuous' },
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

        const tmp = target;
        target = prevTarget;
        prevTarget = tmp;

        pass!.draw(
          target,
          {
            uTime: ctx.t1,
            uPhase: phase * ctx.param('speed'),
            uLines: ctx.discrete('lines', 0),
            uLength: ctx.discrete('length', 0),
            uThickness: ctx.param('thickness'),
            uScale: ctx.param('scale'),
            uCurl: ctx.param('curl'),
            uHue: ctx.param('hue'),
            uHueSpread: ctx.param('hueSpread'),
            uFade: ctx.param('fade'),
            uSeed: seed,
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

export default flowField;
