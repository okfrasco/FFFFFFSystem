/**
 * Colore — palette coseno (a + b·cos 2π(c·luminosità + d + tinta)) mescolata
 * all'immagine, rotazione di tinta, saturazione, contrasto, luminosità,
 * posterize (0 = spento).
 */

import colorFrag from '../../shaders/color.frag?raw';
import type { ModuleDefinition } from '../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../visual/gl';

type V3 = readonly [number, number, number];

/** Palette coseno: [a, b, c, d]. */
export const PALETTES: readonly { name: string; p: readonly [V3, V3, V3, V3] }[] = [
  { name: 'arcobaleno', p: [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1, 1, 1], [0, 0.33, 0.67]] },
  { name: 'fuoco', p: [[0.5, 0.3, 0.2], [0.5, 0.4, 0.3], [1, 1, 0.5], [0, 0.1, 0.2]] },
  { name: 'ghiaccio', p: [[0.4, 0.5, 0.6], [0.4, 0.4, 0.4], [1, 1, 1], [0.6, 0.55, 0.5]] },
  { name: 'acido', p: [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2, 1, 0], [0.5, 0.2, 0.25]] },
  { name: 'notte', p: [[0.2, 0.15, 0.35], [0.3, 0.25, 0.4], [1, 1, 1], [0.3, 0.2, 0.2]] },
  { name: 'bianco e nero', p: [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]] },
];

export const color: ModuleDefinition = {
  manifest: {
    id: 'color',
    name: 'Colore',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'in', type: 'texture' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'palette', label: 'Palette', min: 0, max: PALETTES.length - 1, default: 0, kind: 'discrete', options: PALETTES.map((x) => x.name) },
      { id: 'paletteMix', label: 'Palette mix', min: 0, max: 1, default: 0.7, kind: 'continuous' },
      { id: 'hue', label: 'Tinta', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'saturation', label: 'Saturazione', min: 0, max: 2, default: 1, kind: 'continuous' },
      { id: 'contrast', label: 'Contrasto', min: 0, max: 3, default: 1, kind: 'continuous' },
      { id: 'brightness', label: 'Luminosità', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'posterize', label: 'Posterize', min: 0, max: 16, default: 0, kind: 'discrete' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    return {
      process(ctx, inputs, outputs) {
        if (!ctx.gl) return;
        if (gl !== ctx.gl) {
          gl = ctx.gl;
          pass = new Pass(gl, colorFrag);
          target = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
        }
        const [a, b, c, d] = PALETTES[ctx.discrete('palette', 0)]?.p ?? PALETTES[0]!.p;
        pass!.draw(
          target,
          {
            uHue: ctx.param('hue'),
            uSaturation: ctx.param('saturation'),
            uBrightness: ctx.param('brightness'),
            uContrast: ctx.param('contrast'),
            uPosterize: ctx.param('posterize'),
            uPaletteMix: ctx.param('paletteMix'),
            uPa: a,
            uPb: b,
            uPc: c,
            uPd: d,
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
