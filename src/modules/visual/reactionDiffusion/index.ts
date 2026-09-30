/**
 * Reaction-diffusion — pattern organici alla Gray-Scott.
 * Due sostanze A e B reagiscono e diffondono creando pattern complessi.
 */

import frag from './shader.frag?raw';
import initFrag from './init.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const reactionDiffusion: ModuleDefinition = {
  manifest: {
    id: 'reactionDiffusion',
    name: 'Reaction-diffusion',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'feed', label: 'Feed', min: 0.01, max: 0.1, default: 0.055, kind: 'continuous' },
      { id: 'kill', label: 'Kill', min: 0.04, max: 0.08, default: 0.062, kind: 'continuous' },
      { id: 'diffA', label: 'Diff A', min: 0.5, max: 1.5, default: 1.0, kind: 'continuous' },
      { id: 'diffB', label: 'Diff B', min: 0.2, max: 0.8, default: 0.5, kind: 'continuous' },
      { id: 'steps', label: 'Passi/frame', min: 1, max: 20, default: 8, kind: 'discrete' },
      { id: 'scale', label: 'Scala', min: 0.5, max: 4, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'preset', label: 'Preset', min: 0, max: 4, default: 0, kind: 'discrete', options: ['mitosi', 'coralli', 'spirali', 'onde', 'labirinto'] },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.6, kind: 'continuous' },
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
    const seed = init.seed;

    // Preset values (feed, kill)
    const presets = [
      [0.055, 0.062], // mitosi
      [0.0545, 0.062], // coralli
      [0.018, 0.051], // spirali
      [0.014, 0.054], // onde
      [0.029, 0.057], // labirinto
    ];

    return {
      process(ctx, _inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          initPass = new Pass(gl, initFrag);
          targets = null;
          needsInit = true;
        }
        const size = targetSize(gl);
        const simSize = { width: Math.floor(size.width / ctx.param('scale')), height: Math.floor(size.height / ctx.param('scale')) };
        if (!targets || targets[0].width !== simSize.width || targets[0].height !== simSize.height) {
          if (targets) targets.forEach((t) => deleteTarget(gl!, t));
          targets = [createTarget(gl, simSize.width, simSize.height), createTarget(gl, simSize.width, simSize.height)];
          needsInit = true;
        }

        // Initialize with seed pattern
        if (needsInit) {
          initPass!.draw(targets[0], { uSeed: seed }, {}, simSize);
          initPass!.draw(targets[1], { uSeed: seed }, {}, simSize);
          needsInit = false;
        }

        // Get feed/kill from preset or params
        const preset = ctx.discrete('preset', 0);
        const [pFeed, pKill] = presets[preset] ?? presets[0]!;
        const feed = preset === 0 ? ctx.param('feed') : pFeed!;
        const kill = preset === 0 ? ctx.param('kill') : pKill!;

        // Run simulation steps
        const steps = ctx.discrete('steps', 0);
        for (let i = 0; i < steps; i++) {
          const prev = targets![front]!;
          const next = targets![1 - front]!;
          pass!.draw(
            next,
            {
              uFeed: feed,
              uKill: kill,
              uDiffA: ctx.param('diffA'),
              uDiffB: ctx.param('diffB'),
              uHue: ctx.param('hue'),
            },
            { uState: prev.tex },
            simSize,
          );
          front = 1 - front;
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
      getState: () => null,
      setState() {},
    };
  },
};

export default reactionDiffusion;
