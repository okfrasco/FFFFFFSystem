/**
 * Feedback — il frame precedente rientra trasformato e si fonde con
 * l'ingresso. Zoom, rotazione e spostamento sono velocità al secondo e la
 * quantità è riferita a 60 fps, così il risultato non dipende dal frame rate.
 */

import feedbackFrag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

/** Uniform del feedback per un frame lungo dt secondi (funzione pura, testabile). */
export function feedbackUniforms(p: { amount: number; zoom: number; rotate: number; shiftX: number; shiftY: number }, dt: number) {
  const f = Math.max(0, Math.min(0.1, dt));
  return {
    uAmount: Math.pow(p.amount, f * 60),
    uZoom: Math.exp(p.zoom * f),
    uRotate: p.rotate * f,
    uShift: [p.shiftX * f, p.shiftY * f] as const,
  };
}

export const feedback: ModuleDefinition = {
  manifest: {
    id: 'feedback',
    name: 'Feedback',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'in', type: 'texture' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'amount', label: 'Quantità', min: 0, max: 0.995, default: 0.9, kind: 'continuous' },
      { id: 'zoom', label: 'Zoom', min: -1, max: 1, default: 0.1, kind: 'continuous', unit: '/s' },
      { id: 'rotate', label: 'Rotazione', min: -2, max: 2, default: 0.1, kind: 'continuous', unit: 'rad/s' },
      { id: 'shiftX', label: 'Sposta X', min: -0.5, max: 0.5, default: 0, kind: 'continuous', unit: '/s' },
      { id: 'shiftY', label: 'Sposta Y', min: -0.5, max: 0.5, default: 0, kind: 'continuous', unit: '/s' },
      { id: 'mode', label: 'Fusione', min: 0, max: 2, default: 0, kind: 'discrete', options: ['mix', 'max', 'somma'] },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let targets: [Target, Target] | null = null;
    let front = 0;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, feedbackFrag);
          targets = null;
        }
        const size = targetSize(gl);
        if (!targets || targets[0].width !== size.width || targets[0].height !== size.height) {
          if (targets) targets.forEach((t) => deleteTarget(gl!, t));
          targets = [createTarget(gl, size.width, size.height), createTarget(gl, size.width, size.height)];
        }
        const prev = targets[front]!;
        const next = targets[1 - front]!;
        const u = feedbackUniforms(
          {
            amount: ctx.param('amount'),
            zoom: ctx.param('zoom'),
            rotate: ctx.param('rotate'),
            shiftX: ctx.param('shiftX'),
            shiftY: ctx.param('shiftY'),
          },
          ctx.dt,
        );
        pass!.draw(next, { ...u, uMode: ctx.discrete('mode', 0) }, {
          uIn: (inputs.texture('in')?.handle as WebGLTexture | null) ?? null,
          uPrev: prev.tex,
        });
        front = 1 - front;
        const out = outputs.texture('out');
        out.handle = next.tex;
        out.width = next.width;
        out.height = next.height;
      },
      dispose() {
        if (gl) {
          targets?.forEach((t) => deleteTarget(gl!, t));
          pass?.dispose();
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default feedback;
