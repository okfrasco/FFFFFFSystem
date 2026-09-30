/**
 * Envelope follower — audio → controllo. Segue l'ampiezza dell'ingresso
 * (voci sommate) con attacco e rilascio separati, a picco o RMS, e la manda
 * in uscita come valore di controllo (× gain).
 *
 * L'uscita modula direttamente i nodi audio (nel worklet, senza latenza) e
 * torna al main per i nodi di controllo e i visual.
 */

import { onePole } from '../../core/dsp';
import type { ModuleDefinition } from '../../core/types';

export interface FollowerState {
  /** Media di x² (solo RMS). */
  ms: number;
  /** Inviluppo in uscita. */
  level: number;
}

/**
 * Segue l'inviluppo di un blocco. A picco: |x| con attacco e rilascio.
 * In RMS: prima la media di x² con una costante simmetrica (`avg`), poi la
 * radice con attacco e rilascio (applicarli a x² seguirebbe i picchi).
 */
export function followEnvelope(s: FollowerState, x: ArrayLike<number>, attack: number, release: number, rms: boolean, avg = 0): FollowerState {
  let { ms, level } = s;
  for (let i = 0; i < x.length; i++) {
    let d: number;
    if (rms) {
      ms += (x[i]! * x[i]! - ms) * avg;
      d = Math.sqrt(ms);
    } else d = Math.abs(x[i]!);
    level += (d - level) * (d > level ? attack : release);
  }
  return { ms, level };
}

export const envFollower: ModuleDefinition = {
  manifest: {
    id: 'envFollower',
    name: 'Envelope follower',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'in', type: 'audio', poly: true }],
    outputs: [{ id: 'out', type: 'control', signal: 'value' }],
    params: [
      { id: 'attack', label: 'Attacco', min: 0.001, max: 1, default: 0.01, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'release', label: 'Rilascio', min: 0.01, max: 3, default: 0.15, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'gain', label: 'Gain', min: 0.1, max: 20, default: 2, kind: 'continuous', curve: 'exp' },
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['picco', 'rms'] },
    ],
    seeded: false,
  },
  create() {
    let st: FollowerState = { ms: 0, level: 0 };
    let mono = new Float32Array(0);
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        if (mono.length !== ctx.frames) mono = new Float32Array(ctx.frames);
        mono.fill(0);
        for (const ch of input?.channels ?? []) for (let i = 0; i < ctx.frames; i++) mono[i]! += ch[i]!;
        const sr = ctx.sampleRate;
        const rms = ctx.discrete('mode', 0) === 1;
        st = followEnvelope(st, mono, onePole(ctx.param('attack'), sr), onePole(ctx.param('release'), sr), rms, onePole(0.02, sr));
        if (!Number.isFinite(st.level) || !Number.isFinite(st.ms)) st = { ms: 0, level: 0 };
        outputs.control('out').values[0] = st.level * ctx.param('gain');
      },
      getState: () => ({ ...st }),
      setState(state) {
        st = { ...(state as FollowerState) };
      },
    };
  },
};
