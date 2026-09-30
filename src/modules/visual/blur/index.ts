/**
 * Blur / Bloom — sfocature e bagliori.
 * Blur gaussiano separabile + soglia per bloom.
 */

import blurFrag from './blur.frag?raw';
import bloomFrag from './bloom.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const blur: ModuleDefinition = {
  manifest: {
    id: 'blur',
    name: 'Blur / Bloom',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['blur', 'bloom'] },
      { id: 'amount', label: 'Quantità', min: 0, max: 50, default: 5, kind: 'continuous' },
      { id: 'threshold', label: 'Soglia (bloom)', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'intensity', label: 'Intensità (bloom)', min: 0, max: 3, default: 1, kind: 'continuous' },
      { id: 'passes', label: 'Passaggi', min: 1, max: 4, default: 2, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let blurPass: Pass | null = null;
    let bloomPass: Pass | null = null;
    let targets: Target[] = [];
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          blurPass = new Pass(gl, blurFrag);
          bloomPass = new Pass(gl, bloomFrag);
          targets = [];
        }
        const size = targetSize(gl);
        // Need 2 targets for ping-pong blur
        while (targets.length < 2) {
          targets.push(createTarget(gl, size.width, size.height));
        }
        for (const t of targets) {
          if (t.width !== size.width || t.height !== size.height) {
            deleteTarget(gl, t);
            targets = [
              createTarget(gl, size.width, size.height),
              createTarget(gl, size.width, size.height),
            ];
            break;
          }
        }

        const inTex = (inputs.texture('in')?.handle as WebGLTexture | null) ?? null;
        const mode = ctx.discrete('mode', 0);
        const amount = ctx.param('amount');
        const passes = ctx.discrete('passes', 0);

        let current = inTex;
        let idx = 0;

        // Blur passes (horizontal then vertical)
        for (let p = 0; p < passes; p++) {
          // Horizontal
          blurPass!.draw(
            targets[idx]!,
            { uDirection: [1.0, 0.0], uRadius: amount },
            { uIn: current },
          );
          current = targets[idx]!.tex;
          idx = 1 - idx;

          // Vertical
          blurPass!.draw(
            targets[idx]!,
            { uDirection: [0.0, 1.0], uRadius: amount },
            { uIn: current },
          );
          current = targets[idx]!.tex;
          idx = 1 - idx;
        }

        if (mode === 1) {
          // Bloom: combine blurred with original
          bloomPass!.draw(
            targets[idx]!,
            {
              uThreshold: ctx.param('threshold'),
              uIntensity: ctx.param('intensity'),
            },
            { uIn: inTex, uBlur: current },
          );
          current = targets[idx]!.tex;
        }

        const out = outputs.texture('out');
        out.handle = current;
        out.width = size.width;
        out.height = size.height;
      },
      dispose() {
        if (gl) {
          targets.forEach((t) => deleteTarget(gl!, t));
          blurPass?.dispose();
          bloomPass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default blur;
