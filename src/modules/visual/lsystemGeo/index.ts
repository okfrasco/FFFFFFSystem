/**
 * L-system geometry — il turtle dell'L-system disegnato come struttura geometrica.
 * Regole predefinite per piante, frattali e pattern.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

// L-system rules (axiom, rules, angle)
const SYSTEMS: { axiom: string; rules: Record<string, string>; angle: number }[] = [
  // 0: Fractal tree
  { axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 22.5 },
  // 1: Koch curve
  { axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 90 },
  // 2: Sierpinski
  { axiom: 'F-G-G', rules: { F: 'F-G+F+G-F', G: 'GG' }, angle: 120 },
  // 3: Dragon curve
  { axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90 },
  // 4: Hilbert
  { axiom: 'A', rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' }, angle: 90 },
  // 5: Plant
  { axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25 },
];

function expandLSystem(axiom: string, rules: Record<string, string>, iterations: number): string {
  let result = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const c of result) {
      next += rules[c] ?? c;
    }
    result = next;
    if (result.length > 50000) break; // Limit size
  }
  return result;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
}

function generateSegments(str: string, angleDeg: number): Segment[] {
  const segments: Segment[] = [];
  const stack: { x: number; y: number; angle: number; depth: number }[] = [];
  let x = 0, y = 0, angle = 90; // Start pointing up
  let depth = 0;
  const step = 0.02;

  for (const c of str) {
    if (c === 'F' || c === 'G') {
      const x2 = x + Math.cos(angle * Math.PI / 180) * step;
      const y2 = y + Math.sin(angle * Math.PI / 180) * step;
      segments.push({ x1: x, y1: y, x2, y2, depth });
      x = x2;
      y = y2;
    } else if (c === '+') {
      angle += angleDeg;
    } else if (c === '-') {
      angle -= angleDeg;
    } else if (c === '[') {
      stack.push({ x, y, angle, depth });
      depth++;
    } else if (c === ']') {
      const state = stack.pop();
      if (state) {
        x = state.x;
        y = state.y;
        angle = state.angle;
        depth = state.depth;
      }
    }
  }
  return segments;
}

export const lsystemGeo: ModuleDefinition = {
  manifest: {
    id: 'lsystemGeo',
    name: 'L-system geometry',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [
      { id: 'system', label: 'Sistema', min: 0, max: 5, default: 0, kind: 'discrete', options: ['albero', 'Koch', 'Sierpinski', 'drago', 'Hilbert', 'pianta'] },
      { id: 'iterations', label: 'Iterazioni', min: 1, max: 7, default: 4, kind: 'discrete' },
      { id: 'thickness', label: 'Spessore', min: 0.5, max: 5, default: 1.5, kind: 'continuous' },
      { id: 'growth', label: 'Crescita', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'rotate', label: 'Rotazione', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'zoom', label: 'Zoom', min: 0.5, max: 4, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'hue', label: 'Colore', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'depthColor', label: 'Colore profondità', min: 0, max: 1, default: 0.3, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let gl: WebGL2RenderingContext | null = null;
    let pass: Pass | null = null;
    let target: Target | null = null;
    let cachedSystem = -1;
    let cachedIter = -1;
    let segments: Segment[] = [];
    let segmentData: Float32Array | null = null;
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

        const sysIdx = ctx.discrete('system', 0);
        const iterations = ctx.discrete('iterations', 0);

        // Regenerate if needed
        if (sysIdx !== cachedSystem || iterations !== cachedIter) {
          const sys = SYSTEMS[sysIdx] ?? SYSTEMS[0]!;
          const str = expandLSystem(sys.axiom, sys.rules, iterations);
          segments = generateSegments(str, sys.angle);
          cachedSystem = sysIdx;
          cachedIter = iterations;

          // Pack segments into float array (x1,y1,x2,y2,depth per segment)
          segmentData = new Float32Array(segments.length * 5);
          for (let i = 0; i < segments.length; i++) {
            const s = segments[i]!;
            segmentData[i * 5] = s.x1;
            segmentData[i * 5 + 1] = s.y1;
            segmentData[i * 5 + 2] = s.x2;
            segmentData[i * 5 + 3] = s.y2;
            segmentData[i * 5 + 4] = s.depth;
          }
        }

        const phase = inputs.phase('phase')?.end[0] ?? ctx.t1 * 0.1;
        const growth = ctx.param('growth');
        const visibleCount = Math.floor(segments.length * growth);

        pass!.draw(target, {
          uSegmentCount: visibleCount,
          uTotalSegments: segments.length,
          uThickness: ctx.param('thickness'),
          uRotate: ctx.param('rotate') * Math.PI * 2 + phase * Math.PI * 2,
          uZoom: ctx.param('zoom'),
          uHue: ctx.param('hue'),
          uDepthColor: ctx.param('depthColor'),
          uPhase: phase,
        });

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

export default lsystemGeo;
