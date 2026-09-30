/**
 * Automa texture — Game of Life o automi 1D disegnati come immagine.
 * Gli automi evolvono a tempo con la fase.
 */

import frag from './shader.frag?raw';
import initFrag from './init.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const automata: ModuleDefinition = {
  manifest: {
    id: 'automata',
    name: 'Automa texture',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'type', label: 'Tipo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['Game of Life', 'Wolfram 1D', 'Brian\'s Brain'] },
      { id: 'rule', label: 'Regola (1D)', min: 0, max: 255, default: 110, kind: 'discrete' },
      { id: 'speed', label: 'Velocità', min: 1, max: 10, default: 1, kind: 'discrete' },
      { id: 'scale', label: 'Scala', min: 1, max: 8, default: 2, kind: 'discrete' },
      { id: 'wrap', label: 'Bordi', min: 0, max: 1, default: 1, kind: 'discrete', options: ['fermi', 'wrap'] },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'fade', label: 'Scia', min: 0, max: 0.95, default: 0, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let initPass: Pass | null = null;
    let targets: [Target, Target] | null = null;
    let front = 0;
    let needsInit = true;
    let lastStep = 0;
    const seed = init.seed;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          initPass = new Pass(gl, initFrag);
          targets = null;
          needsInit = true;
        }
        const size = targetSize(gl);
        const scale = ctx.discrete('scale', 0);
        const simSize = { width: Math.floor(size.width / scale), height: Math.floor(size.height / scale) };
        if (!targets || targets[0].width !== simSize.width || targets[0].height !== simSize.height) {
          if (targets) targets.forEach((t) => deleteTarget(gl!, t));
          targets = [
            createTarget(gl, simSize.width, simSize.height, false),
            createTarget(gl, simSize.width, simSize.height, false),
          ];
          needsInit = true;
        }

        if (needsInit) {
          initPass!.draw(targets[0], { uSeed: seed, uType: ctx.discrete('type', 0) }, {}, simSize);
          initPass!.draw(targets[1], { uSeed: seed, uType: ctx.discrete('type', 0) }, {}, simSize);
          needsInit = false;
          lastStep = 0;
        }

        // Step based on phase
        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.25;
        const speed = ctx.discrete('speed', 0);
        const currentStep = Math.floor(phase * 60 * speed);

        if (currentStep > lastStep) {
          const steps = Math.min(currentStep - lastStep, 10);
          for (let i = 0; i < steps; i++) {
            const prev = targets![front]!;
            const next = targets![1 - front]!;
            pass!.draw(
              next,
              {
                uType: ctx.discrete('type', 0),
                uRule: ctx.discrete('rule', 0),
                uWrap: ctx.discrete('wrap', 0),
                uHue: ctx.param('hue'),
                uFade: ctx.param('fade'),
              },
              { uState: prev.tex },
              simSize,
            );
            front = 1 - front;
          }
          lastStep = currentStep;
        }

        const out = outputs.texture('out');
        out.handle = targets![front]!.tex;
        out.width = targets![front]!.width;
        out.height = targets![front]!.height;
      },
      dispose() {
        if (gl) {
          targets?.forEach((t) => deleteTarget(gl!, t));
          pass?.dispose();
          initPass?.dispose();
        }
      },
      getState: () => ({ lastStep }),
      setState(s: unknown) {
        if (s && typeof s === 'object' && 'lastStep' in s) lastStep = (s as { lastStep: number }).lastStep;
      },
    };
  },
};

export default automata;
