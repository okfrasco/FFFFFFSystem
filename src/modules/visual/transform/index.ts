/**
 * Transform — ripensa lo spazio dell'immagine: zoom, rotazione,
 * kaleidoscopio (spicchi specchiati), tile, specchi orizzontale e verticale,
 * spostamento. La rotazione gira in `spin` radianti al secondo, oppure, se la
 * fase è collegata, in `spin` giri per ciclo della fase (a tempo con la musica).
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const transform: ModuleDefinition = {
  manifest: {
    id: 'transform',
    name: 'Transform',
    category: 'visual',
    rate: 'frame',
    inputs: [
      { id: 'in', type: 'texture' },
      { id: 'phase', type: 'phase' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'segments', label: 'Kaleido', min: 0, max: 16, default: 6, kind: 'discrete' },
      { id: 'zoom', label: 'Zoom', min: 0.25, max: 4, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'angle', label: 'Angolo', min: 0, max: 1, default: 0, kind: 'continuous', unit: 'giri' },
      { id: 'spin', label: 'Rotazione', min: -2, max: 2, default: 0.1, kind: 'continuous' },
      { id: 'tile', label: 'Tile', min: 1, max: 8, default: 1, kind: 'discrete' },
      { id: 'mirrorX', label: 'Specchio X', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'mirrorY', label: 'Specchio Y', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'offsetX', label: 'Sposta X', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
      { id: 'offsetY', label: 'Sposta Y', min: -0.5, max: 0.5, default: 0, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    let freeAngle = 0;
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
        const phase = inputs.phase('phase');
        const spin = ctx.param('spin');
        let angle = ctx.param('angle') * 2 * Math.PI;
        if (phase) angle += ((phase.end[0] ?? 0) * spin * 2 * Math.PI) % (2 * Math.PI);
        else {
          freeAngle = (freeAngle + spin * Math.min(0.1, ctx.dt)) % (2 * Math.PI);
          angle += freeAngle;
        }
        pass!.draw(
          target,
          {
            uZoom: ctx.param('zoom'),
            uAngle: angle,
            uSegments: ctx.param('segments'),
            uTile: ctx.param('tile'),
            uMirrorX: ctx.param('mirrorX'),
            uMirrorY: ctx.param('mirrorY'),
            uOffset: [ctx.param('offsetX'), ctx.param('offsetY')],
          },
          { uIn: (inputs.texture('in')?.handle as WebGLTexture | null) ?? null },
        );
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

export default transform;
