/**
 * Time echo — buffer di frame: ritardi e scie temporali.
 * Mantiene N frame in memoria e li combina.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const timeEcho: ModuleDefinition = {
  manifest: {
    id: 'timeEcho',
    name: 'Time echo',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'frames', label: 'Frame', min: 2, max: 16, default: 8, kind: 'discrete' },
      { id: 'mode', label: 'Modo', min: 0, max: 3, default: 0, kind: 'discrete', options: ['somma', 'differenza', 'max', 'scia'] },
      { id: 'decay', label: 'Decadimento', min: 0.5, max: 1, default: 0.9, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    let frameBuffer: Target[] = [];
    let writeIdx = 0;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          target = null;
          frameBuffer = [];
        }
        const size = targetSize(gl);
        const numFrames = ctx.discrete('frames', 0);

        // Ensure we have enough frame buffers
        while (frameBuffer.length < numFrames) {
          frameBuffer.push(createTarget(gl, size.width, size.height));
        }
        // Remove excess
        while (frameBuffer.length > numFrames) {
          deleteTarget(gl, frameBuffer.pop()!);
        }

        // Check size
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
          frameBuffer.forEach((t) => deleteTarget(gl!, t));
          frameBuffer = [];
          for (let i = 0; i < numFrames; i++) {
            frameBuffer.push(createTarget(gl, size.width, size.height));
          }
          writeIdx = 0;
        }

        const inTex = (inputs.texture('in')?.handle as WebGLTexture | null) ?? null;

        // Copy current input to frame buffer
        if (inTex && frameBuffer[writeIdx]) {
          // Simple copy shader would be better, but we can use the main pass
          gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer[writeIdx]!.fbo);
          gl.viewport(0, 0, size.width, size.height);
          // Draw input to this frame buffer
          const copyPass = new Pass(gl, `#version 300 es
            precision highp float;
            in vec2 vUv;
            out vec4 outColor;
            uniform sampler2D uTex;
            void main() { outColor = texture(uTex, vUv); }
          `);
          copyPass.draw(frameBuffer[writeIdx]!, {}, { uTex: inTex });
          copyPass.dispose();
        }

        // Combine all frames
        pass!.draw(
          target,
          {
            uNumFrames: numFrames,
            uMode: ctx.discrete('mode', 0),
            uDecay: ctx.param('decay'),
            uMix: ctx.param('mix'),
            uWriteIdx: writeIdx,
          },
          {
            uIn: inTex,
            uFrame0: frameBuffer[0]?.tex ?? null,
            uFrame1: frameBuffer[1]?.tex ?? null,
            uFrame2: frameBuffer[2]?.tex ?? null,
            uFrame3: frameBuffer[3]?.tex ?? null,
          },
        );

        writeIdx = (writeIdx + 1) % numFrames;

        const out = outputs.texture('out');
        out.handle = target.tex;
        out.width = target.width;
        out.height = target.height;
      },
      dispose() {
        if (gl) {
          deleteTarget(gl, target);
          frameBuffer.forEach((t) => deleteTarget(gl!, t));
          pass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default timeEcho;
