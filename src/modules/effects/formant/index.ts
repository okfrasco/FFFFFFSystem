/**
 * Formanti — tre passa-banda sulle formanti delle vocali: `vowel` scorre in
 * continuo a → e → i → o → u (anche al campione, con `mod`), `shift` sposta
 * tutte le formanti (voce più piccola o più grande). Su una saw o su un
 * rumore: la sintesi della voce più semplice.
 */

import { channel } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const VOWELS = ['a', 'e', 'i', 'o', 'u'] as const;
/** Formanti F1–F3 (Hz) e i loro guadagni per vocale. */
const TABLE: readonly (readonly [number, number, number])[] = [
  [730, 1090, 2440],
  [530, 1840, 2480],
  [270, 2290, 3010],
  [570, 840, 2410],
  [300, 870, 2240],
];
const GAINS = [1, 0.5, 0.25];

export function formantsAt(vowel: number, shift: number): number[] {
  const x = Math.max(0, Math.min(VOWELS.length - 1, vowel));
  const i = Math.min(VOWELS.length - 2, Math.floor(x));
  const t = x - i;
  return [0, 1, 2].map((k) => (TABLE[i]![k]! + (TABLE[i + 1]![k]! - TABLE[i]![k]!) * t) * shift);
}

export const formant: ModuleDefinition = {
  manifest: {
    id: 'formant',
    name: 'Formanti',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'mod', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'vowel', label: 'Vocale', min: 0, max: VOWELS.length - 1, default: 0, kind: 'continuous' },
      { id: 'shift', label: 'Spostamento', min: 0.5, max: 2, default: 1, kind: 'continuous', curve: 'exp' },
      { id: 'q', label: 'Q', min: 2, max: 30, default: 10, kind: 'continuous', curve: 'exp' },
      { id: 'modDepth', label: 'Mod', min: -4, max: 4, default: 2, kind: 'continuous' },
      { id: 'mix', label: 'Mix', min: 0, max: 1, default: 1, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const st: Float64Array[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const modIn = inputs.audio('mod');
        const n = input?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (st.length < n) st.push(new Float64Array(6));
        const sr = ctx.sampleRate;
        const vowel = ctx.param('vowel');
        const shift = ctx.param('shift');
        const k = 1 / ctx.param('q');
        const depth = ctx.param('modDepth');
        const mix = ctx.param('mix');
        const coefs = (vw: number) =>
          formantsAt(vw, shift).map((f) => {
            const g = Math.tan((Math.PI * Math.min(0.45 * sr, f)) / sr);
            const a1 = 1 / (1 + g * (g + k));
            return [a1, g * a1, g * g * a1] as const;
          });
        let cs = coefs(vowel);
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const m = channel(modIn, v);
          const o = out[v]!;
          const s = st[v]!;
          for (let i = 0; i < ctx.frames; i++) {
            if (m && (i & 7) === 0) cs = coefs(vowel + depth * m[i]!);
            const v0 = x ? x[i]! : 0;
            let y = 0;
            for (let b = 0; b < 3; b++) {
              const [a1, a2, a3] = cs[b]!;
              const ic1 = s[b * 2]!;
              const ic2 = s[b * 2 + 1]!;
              const v3 = v0 - ic2;
              const v1 = a1 * ic1 + a2 * v3;
              const v2 = ic2 + a2 * ic1 + a3 * v3;
              s[b * 2] = 2 * v1 - ic1;
              s[b * 2 + 1] = 2 * v2 - ic2;
              y += v1 * k * 2 * GAINS[b]!;
            }
            o[i] = v0 * (1 - mix) + y * mix * 2;
          }
          for (let j = 0; j < 6; j++) if (!Number.isFinite(s[j]!)) s[j] = 0;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default formant;
