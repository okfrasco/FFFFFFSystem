/**
 * Attrattore — tre segnali continui e correlati da un sistema caotico:
 * Lorenz, Rössler o Thomas. Il tempo del sistema avanza con la fase
 * (`speed` unità di tempo per ciclo): segue il tempo musicale e si ferma se
 * la musica si ferma; senza fase avanza in secondi. `chaos` è il parametro
 * che porta il sistema da ordinato a caotico (ρ di Lorenz, c di Rössler,
 * b di Thomas). Uscite x, y, z normalizzate 0–1, e un trigger quando x
 * attraversa la metà salendo (una sezione di Poincaré), con z come valore.
 */

import type { ModuleDefinition } from '../../../core/types';

export const ATTRACTORS = ['Lorenz', 'Rössler', 'Thomas'] as const;
type V3 = [number, number, number];

/** Derivata del sistema; `chaos` in 0–1. */
export function deriv(kind: number, p: V3, chaos: number): V3 {
  const [x, y, z] = p;
  if (kind === 0) {
    const rho = 10 + 30 * chaos;
    return [10 * (y - x), x * (rho - z) - y, x * y - (8 / 3) * z];
  }
  if (kind === 1) {
    const c = 3 + 5 * chaos;
    return [-y - z, x + 0.2 * y, 0.2 + z * (x - c)];
  }
  const b = 0.3 - 0.2 * chaos;
  return [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z];
}

/** Intervalli tipici delle tre coordinate, per normalizzarle. */
const RANGES: [V3, V3][] = [
  [
    [-22, -30, 0],
    [22, 30, 55],
  ],
  [
    [-12, -12, 0],
    [14, 12, 25],
  ],
  [
    [-5, -5, -5],
    [5, 5, 5],
  ],
];

export function rk4(kind: number, p: V3, chaos: number, h: number): V3 {
  const add = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const k1 = deriv(kind, p, chaos);
  const k2 = deriv(kind, add(p, k1, h / 2), chaos);
  const k3 = deriv(kind, add(p, k2, h / 2), chaos);
  const k4 = deriv(kind, add(p, k3, h), chaos);
  return [0, 1, 2].map((i) => p[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as V3;
}

export const normalizeAttractor = (kind: number, p: V3): V3 => {
  const [lo, hi] = RANGES[kind] ?? RANGES[0]!;
  return [0, 1, 2].map((i) => Math.max(0, Math.min(1, (p[i]! - lo[i]!) / (hi[i]! - lo[i]!)))) as V3;
};

interface AttrState {
  p: V3;
  kind: number;
}

export const attractor: ModuleDefinition = {
  manifest: {
    id: 'attractor',
    name: 'Attrattore',
    category: 'generators',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'x', type: 'control', signal: 'value' },
      { id: 'y', type: 'control', signal: 'value' },
      { id: 'z', type: 'control', signal: 'value' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    params: [
      { id: 'system', label: 'Sistema', min: 0, max: ATTRACTORS.length - 1, default: 0, kind: 'discrete', options: [...ATTRACTORS] },
      { id: 'speed', label: 'Velocità', min: 0.05, max: 10, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'chaos', label: 'Caos', min: 0, max: 1, default: 0.6, kind: 'continuous' },
    ],
    seeded: true,
  },
  create(init) {
    const jitter = ((init.seed % 1000) / 1000) * 0.01;
    let s: AttrState = { p: [1 + jitter, 1, 1], kind: -1 };
    return {
      process(ctx, inputs, outputs) {
        const kind = ctx.discrete('system', ctx.tick);
        if (kind !== s.kind) s = { p: kind === 2 ? [0.1 + jitter, 0, 0] : [1 + jitter, 1, 1], kind };
        const ph = inputs.phase('phase');
        const advance = (ph ? Math.max(0, ph.end[0]! - ph.start[0]!) : ctx.dt) * ctx.param('speed');
        const chaos = ctx.param('chaos');
        const sub = Math.max(1, Math.ceil(advance / 0.005));
        const before = normalizeAttractor(kind, s.p)[0];
        for (let i = 0; i < sub; i++) s.p = rk4(kind, s.p, chaos, advance / sub);
        if (!s.p.every(Number.isFinite)) s.p = [1 + jitter, 1, 1];
        const n = normalizeAttractor(kind, s.p);
        outputs.control('x').values[0] = n[0];
        outputs.control('y').values[0] = n[1];
        outputs.control('z').values[0] = n[2];
        if (before < 0.5 && n[0] >= 0.5) {
          outputs.control('trig').events.push({ kind: 'trig', t: ctx.t0 + ((0.5 - before) / (n[0] - before)) * ctx.dt, voice: 0, vel: 1, value: n[2] });
        }
      },
      getState: () => ({ p: [...s.p], kind: s.kind }),
      setState(state) {
        const st = state as AttrState;
        s = { p: [...st.p] as V3, kind: st.kind };
      },
    };
  },
};

export default attractor;
