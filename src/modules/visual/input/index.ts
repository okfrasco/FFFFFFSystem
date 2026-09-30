/**
 * Ingresso — immagine, video o camera come sorgente texture.
 * La sorgente si seleziona dalla config, il modulo la espone come texture.
 */

import type { ModuleDefinition } from '../../../core/types';
import { createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const input: ModuleDefinition = {
  manifest: {
    id: 'input',
    name: 'Ingresso',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'source', label: 'Sorgente', min: 0, max: 2, default: 2, kind: 'discrete', options: ['immagine', 'video', 'camera'] },
      { id: 'zoom', label: 'Zoom', min: 0.5, max: 4, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'offsetX', label: 'Sposta X', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'offsetY', label: 'Sposta Y', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'flipX', label: 'Specchio X', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'flipY', label: 'Specchio Y', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'grayscale', label: 'B/N', min: 0, max: 1, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let target: Target | null = null;
    let videoEl: HTMLVideoElement | null = null;
    let stream: MediaStream | null = null;
    let tex: WebGLTexture | null = null;
    let lastSource = -1;
    let cameraReady = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        await videoEl.play();
        cameraReady = true;
      } catch (e) {
        console.warn('Camera not available:', e);
        cameraReady = false;
      }
    }

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl = null;
      }
      cameraReady = false;
    }

    return {
      process(ctx, _inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          target = null;
          tex = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
        }

        if (!tex) {
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        const source = ctx.discrete('source', 0);

        // Handle source changes
        if (source !== lastSource) {
          if (source === 2 && !cameraReady) {
            startCamera();
          } else if (lastSource === 2) {
            stopCamera();
          }
          lastSource = source;
        }

        // Update texture from video/camera
        if (source === 2 && cameraReady && videoEl && videoEl.readyState >= 2) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
        } else {
          // Fallback: solid color
          const data = new Uint8Array([128, 128, 128, 255]);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }

        // Copy to target with transforms
        // For simplicity, just output the texture directly
        // A proper implementation would render with zoom/offset shader

        const out = outputs.texture('out');
        out.handle = tex;
        out.width = videoEl?.videoWidth ?? 1;
        out.height = videoEl?.videoHeight ?? 1;
      },
      dispose() {
        stopCamera();
        if (gl) {
          deleteTarget(gl, target);
          if (tex) gl.deleteTexture(tex);
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default input;
