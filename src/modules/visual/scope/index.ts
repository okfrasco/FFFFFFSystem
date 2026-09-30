/**
 * Scope — oscilloscopio XY, audio come geometria.
 * Disegna la forma d'onda del segnale audio in ingresso.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const scope: ModuleDefinition = {
  manifest: {
    id: 'scope',
    name: 'Scope',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'audio', type: 'audio' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: ['lineare', 'XY', 'radiale'] },
      { id: 'thickness', label: 'Spessore', min: 0.5, max: 10, default: 2, kind: 'continuous' },
      { id: 'zoom', label: 'Zoom', min: 0.5, max: 4, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'glow', label: 'Bagliore', min: 0, max: 2, default: 0.5, kind: 'continuous' },
      { id: 'persistence', label: 'Persistenza', min: 0, max: 0.98, default: 0.8, kind: 'continuous' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    let prevTarget: Target | null = null;
    let waveformTex: WebGLTexture | null = null;
    const waveformData = new Float32Array(1024);
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, frag);
          target = null;
          prevTarget = null;
          waveformTex = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          deleteTarget(gl, prevTarget);
          target = createTarget(gl, size.width, size.height);
          prevTarget = createTarget(gl, size.width, size.height);
        }

        // Create waveform texture if needed
        if (!waveformTex) {
          waveformTex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, waveformTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        // Get audio data (use sine wave for now, real audio requires worklet bridge)
        const audioIn = inputs.audio?.('audio');
        if (audioIn && audioIn.channels && audioIn.channels.length > 0) {
          const samples = audioIn.channels[0]!;
          const len = Math.min(samples.length, 1024);
          for (let i = 0; i < len; i++) {
            waveformData[i] = samples[i] ?? 0;
          }
        } else {
          // Sine wave fallback for testing
          const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.5;
          for (let i = 0; i < 1024; i++) {
            const t = i / 1024;
            waveformData[i] = Math.sin((t + phase) * Math.PI * 8) * 0.5;
          }
        }

        // Upload waveform to texture
        gl.bindTexture(gl.TEXTURE_2D, waveformTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1024, 1, 0, gl.RED, gl.FLOAT, waveformData);

        // Swap targets
        const tmp = target;
        target = prevTarget;
        prevTarget = tmp;

        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.25;

        pass!.draw(
          target,
          {
            uMode: ctx.discrete('mode', 0),
            uThickness: ctx.param('thickness'),
            uZoom: ctx.param('zoom'),
            uGlow: ctx.param('glow'),
            uPersistence: ctx.param('persistence'),
            uHue: ctx.param('hue'),
            uRotate: ctx.param('rotate') * Math.PI * 2 + phase * 0.1,
          },
          { uWaveform: waveformTex, uPrev: prevTarget!.tex },
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
          if (waveformTex) gl.deleteTexture(waveformTex);
          pass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default scope;
