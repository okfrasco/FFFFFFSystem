#!/usr/bin/env node
// Crea lo scheletro di un modulo:
//   npm run nuovo -- <categoria> <id> [control|audio|frame]
// Esempio: npm run nuovo -- ideas karplus audio
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const CATEGORIES = ['phase', 'generators', 'logic', 'transform', 'harmony', 'audio', 'effects', 'visual', 'io', 'ideas'];
const [category, id, rateArg] = process.argv.slice(2);
const fail = (msg) => {
  console.error(`\n  ${msg}\n\n  uso: npm run nuovo -- <categoria> <id> [control|audio|frame]\n  categorie: ${CATEGORIES.join(', ')}\n`);
  process.exit(1);
};
if (!category || !id) fail('servono categoria e id');
if (!CATEGORIES.includes(category)) fail(`categoria sconosciuta: ${category}`);
if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`id non valido: ${id} (camelCase, es. karplusStrong)`);
const rate = rateArg ?? (category === 'audio' || category === 'effects' ? 'audio' : category === 'visual' ? 'frame' : 'control');
if (!['control', 'audio', 'frame'].includes(rate)) fail(`rate sconosciuto: ${rate}`);
if (rate === 'audio' && !['audio', 'effects', 'io'].includes(category))
  fail(`un modulo audio va in audio/, effects/ o io/ (l'AudioWorklet carica solo quelle): es. npm run nuovo -- audio ${id}`);
const dir = `src/modules/${category}/${id}`;
if (existsSync(dir)) fail(`esiste già: ${dir}`);
const name = id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const control = `/**
 * ${name} — (descrivi cosa fa, in una frase).
 * Legge la fase: a ogni step manda un trigger con un valore.
 */

import { stepCrossings } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';

export const ${id}: ModuleDefinition = {
  manifest: {
    id: '${id}',
    name: '${name}',
    category: '${category}',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
    ],
    params: [{ id: 'steps', label: 'Step', min: 1, max: 64, default: 16, kind: 'discrete' }, ...STANDARD_GENERATOR_PARAMS],
    seeded: true,
  },
  create() {
    let value = 0;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const trig = outputs.control('trig');
        const steps = ctx.discrete('steps', Math.floor(ph.start[0]!));
        for (const hit of stepCrossings(ph.start[0]!, ph.end[0]!, steps, ctx.t0, ctx.t1, ctx.param('swing'))) {
          value = ctx.rng.float(); // la tua idea qui
          trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel: 1, value });
        }
        outputs.control('value').values[0] = value;
      },
      getState: () => ({ value }),
      setState(state) {
        value = (state as { value: number }).value;
      },
    };
  },
};

export default ${id};
`;

const audio = `/**
 * ${name} — (descrivi cosa fa, in una frase).
 * Blocchi di ctx.frames campioni; una voce per canale dell'ingresso.
 * Le memorie (linee di ritardo…) si allocano al primo process.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const ${id}: ModuleDefinition = {
  manifest: {
    id: '${id}',
    name: '${name}',
    category: '${category}',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [{ id: 'amount', label: 'Quantità', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
    seeded: false,
  },
  create() {
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        const amount = ctx.param('amount');
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const o = out[v]!;
          for (let i = 0; i < ctx.frames; i++) o[i] = (x ? x[i]! : 0) * amount; // la tua idea qui
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default ${id};
`;

const frame = `/**
 * ${name} — (descrivi cosa fa, in una frase).
 * Uno shader a schermo intero (shader.frag); la fase entra come uniform.
 */

import frag from './shader.frag?raw';
import type { ModuleDefinition } from '../../../core/types';
import { Pass, createTarget, deleteTarget, targetSize, type Target } from '../../../visual/gl';

export const ${id}: ModuleDefinition = {
  manifest: {
    id: '${id}',
    name: '${name}',
    category: '${category}',
    rate: 'frame',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'in', type: 'texture' },
    ],
    outputs: [{ id: 'out', type: 'texture' }],
    params: [{ id: 'amount', label: 'Quantità', min: 0, max: 1, default: 0.5, kind: 'continuous' }],
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
          pass = new Pass(gl, frag);
          target = null;
        }
        const size = targetSize(gl);
        if (!target || target.width !== size.width || target.height !== size.height) {
          deleteTarget(gl, target);
          target = createTarget(gl, size.width, size.height);
        }
        pass!.draw(
          target,
          { uPhase: (inputs.phase('phase')?.end[0] ?? 0) % 1000, uAmount: ctx.param('amount') },
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

export default ${id};
`;

const shader = `#version 300 es
// ${name}
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uPhase;
uniform float uAmount;
uniform sampler2D uIn;

void main() {
  vec3 base = texture(uIn, vUv).rgb;
  float ring = 0.5 + 0.5 * sin(40.0 * length(vUv - 0.5) - 6.2831853 * uPhase);
  outColor = vec4(mix(base, vec3(ring), uAmount), 1.0);
}
`;

const tests = {
  control: `import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate } from '../../../../tests/helpers/sim';

describe('${name}', () => {
  it('manda un trigger per step, riproducibile a seed fisso', () => {
    const run = (seed: number) => {
      const sim = simulate([TRANSPORT, { id: 'n', module: '${id}' }], [{ from: 'tr.bar', to: 'n.phase' }], ['n.trig'], seed);
      sim.runTo(2);
      return compact(sim.events('n.trig'));
    };
    expect(run(1)).toHaveLength(32);
    expect(run(1)).toEqual(run(1));
  });
});
`,
  audio: `import { describe, expect, it } from 'vitest';
import { audioSim } from '../../../../tests/helpers/audio';

describe('${name}', () => {
  it('lascia passare il segnale scalato dalla quantità', () => {
    const y = audioSim(
      [{ id: 's', module: 'signal', config: { fn: () => 1 } }, { id: 'n', module: '${id}', params: { amount: 0.25 } }],
      [{ from: 's.out', to: 'n.in' }],
      ['n.out'],
    )
      .run(0.01)
      .get('n.out')![0]!;
    expect(y[10]).toBeCloseTo(0.25, 6);
  });
});
`,
  frame: `import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../../core/registry';
import ${id} from './index';

describe('${name}', () => {
  // lo shader si prova nel browser; qui il manifest e le funzioni pure
  it('manifest valido', () => {
    expect(validateManifest(${id}.manifest)).toEqual([]);
  });
});
`,
};

const note = `# ${name}

Categoria: ${category} · rate: ${rate}

## L'idea

(da dove viene, cosa voglio sentire o vedere)

## Da provare

- 
`;

mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/index.ts`, rate === 'audio' ? audio : rate === 'frame' ? frame : control);
writeFileSync(`${dir}/index.test.ts`, tests[rate]);
writeFileSync(`${dir}/NOTE.md`, note);
if (rate === 'frame') writeFileSync(`${dir}/shader.frag`, shader);
console.log(`\n  creato ${dir}/ (${rate})\n  compare già nel menu dell'editor; test: npx vitest run ${dir}\n`);
