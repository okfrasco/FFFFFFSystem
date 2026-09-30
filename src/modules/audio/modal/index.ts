/**
 * Modale — un banco di risonatori (fino a 24 modi per voce) intonati come un
 * oggetto fisico: corda, barra, membrana, campana, ciotola di vetro,
 * piastra. Ogni nota eccita i modi con un colpo (impulso, rumore o
 * martelletto); `in` permette di eccitarli con un segnale audio (voce 0,
 * sulla nota del parametro). `decay` è il T60 del modo più basso, `damping`
 * accorcia i modi alti; `position` è il punto di eccitazione (i modi con un
 * nodo lì tacciono); `inharm` stira le frequenze.
 */

import { channel, framedEvents, mtof } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

const squarePlate = (): number[] => {
  const set = new Set<number>();
  for (let m = 1; m <= 7; m++) for (let n = 1; n <= 7; n++) set.add(m * m + n * n);
  return [...set].sort((a, b) => a - b).map((x) => x / 2);
};

export const MATERIALS: readonly { name: string; ratios: readonly number[] }[] = [
  { name: 'corda', ratios: Array.from({ length: 24 }, (_, i) => i + 1) },
  { name: 'barra', ratios: Array.from({ length: 24 }, (_, i) => ((2 * i + 3) / 3) ** 2) },
  { name: 'membrana', ratios: [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6, 3.652, 4.06, 4.154, 4.601, 4.832, 4.903, 5.131, 5.412, 5.494, 5.535, 5.954, 6.064, 6.204, 6.209, 6.567] },
  { name: 'campana', ratios: [0.5, 1, 1.183, 1.506, 2, 2.514, 2.662, 3.011, 4.166, 5.433, 6.796, 8.215, 9.667, 11.2, 12.8, 14.4, 16.1, 17.9, 19.7, 21.6, 23.5, 25.5, 27.6, 29.8] },
  { name: 'vetro', ratios: [1, 2.32, 4.25, 6.63, 9.38, 12.3, 15.9, 19.6, 23.7, 28.1, 32.8, 37.8, 43.1, 48.7, 54.6, 60.8, 67.3, 74.1, 81.2, 88.6, 96.3, 104, 112.6, 121] },
  { name: 'piastra', ratios: squarePlate().slice(0, 24) },
];

export const EXCITERS = ['impulso', 'rumore', 'martelletto'] as const;

interface ModalVoice {
  y1: Float64Array;
  y2: Float64Array;
  a1: Float64Array;
  a2: Float64Array;
  b0: Float64Array;
  /** Campioni di colpo ancora da mandare. */
  burst: number;
  burstLen: number;
  vel: number;
  offAt: number;
  age: number;
  active: boolean;
  quiet: number;
}

const MAX_MODES = 24;
const newVoice = (): ModalVoice => ({
  y1: new Float64Array(MAX_MODES),
  y2: new Float64Array(MAX_MODES),
  a1: new Float64Array(MAX_MODES),
  a2: new Float64Array(MAX_MODES),
  b0: new Float64Array(MAX_MODES),
  burst: 0,
  burstLen: 1,
  vel: 0,
  offAt: Infinity,
  age: 0,
  active: false,
  quiet: 0,
});

/** Modi di una nota: frequenza, T60 e ampiezza, per la view e per le voci. */
export function modesOf(
  note: number,
  material: number,
  count: number,
  decay: number,
  damping: number,
  brightness: number,
  position: number,
  inharm: number,
  sr: number,
): { f: number; t60: number; amp: number }[] {
  const ratios = (MATERIALS[material] ?? MATERIALS[0]!).ratios;
  const f0 = mtof(note);
  const out: { f: number; t60: number; amp: number }[] = [];
  for (let k = 0; k < count && k < ratios.length; k++) {
    const r = ratios[k]! * (1 + inharm * k * k * 0.002);
    const f = f0 * r;
    if (f >= 0.45 * sr) break;
    const t60 = decay / (1 + damping * (r - 1) * 0.6);
    const amp = Math.pow(k + 1, -1.2 + 1.4 * brightness) * (0.08 + Math.abs(Math.sin(Math.PI * (k + 1) * position)));
    out.push({ f, t60, amp });
  }
  return out;
}

export const modal: ModuleDefinition = {
  manifest: {
    id: 'modal',
    name: 'Modale',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'in', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio' }],
    params: [
      { id: 'material', label: 'Materiale', min: 0, max: MATERIALS.length - 1, default: 3, kind: 'discrete', options: MATERIALS.map((m) => m.name) },
      { id: 'modes', label: 'Modi', min: 2, max: MAX_MODES, default: 16, kind: 'discrete' },
      { id: 'decay', label: 'Decadimento', min: 0.05, max: 20, default: 2.5, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'damping', label: 'Smorzamento', min: 0, max: 1, default: 0.4, kind: 'continuous' },
      { id: 'brightness', label: 'Brillantezza', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'position', label: 'Posizione', min: 0.02, max: 0.5, default: 0.21, kind: 'continuous' },
      { id: 'inharm', label: 'Inarmonicità', min: -1, max: 1, default: 0, kind: 'continuous' },
      { id: 'exciter', label: 'Colpo', min: 0, max: EXCITERS.length - 1, default: 2, kind: 'discrete', options: [...EXCITERS] },
      { id: 'hardness', label: 'Durezza', min: 0, max: 1, default: 0.6, kind: 'continuous' },
      { id: 'voices', label: 'Voci', min: 1, max: 8, default: 4, kind: 'discrete' },
      { id: 'release', label: 'Rilascio', min: 0.02, max: 20, default: 20, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'pitch', label: 'Nota', min: 12, max: 108, default: 60, kind: 'discrete' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: true,
  },
  create() {
    const voices: ModalVoice[] = [];
    let counter = 0;
    const notes: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const sr = ctx.sampleRate;
        const nv = ctx.discrete('voices', 0);
        while (voices.length < nv) voices.push(newVoice());
        const out = outputs.audio('out').channels[0]!;
        out.fill(0);
        const count = ctx.discrete('modes', 0);
        const exciter = ctx.discrete('exciter', 0);
        const hard = ctx.param('hardness');
        const level = ctx.param('level');
        const release = ctx.param('release');
        const setup = (vo: ModalVoice, note: number, t60scale: number) => {
          const modes = modesOf(note, ctx.discrete('material', 0), count, ctx.param('decay') * t60scale, ctx.param('damping'), ctx.param('brightness'), ctx.param('position'), ctx.param('inharm'), sr);
          vo.b0.fill(0);
          modes.forEach((m, k) => {
            const w = (2 * Math.PI * m.f) / sr;
            const r = Math.exp(-6.91 / (m.t60 * sr));
            vo.a1[k] = 2 * r * Math.cos(w);
            vo.a2[k] = r * r;
            vo.b0[k] = m.amp * Math.sin(w);
          });
        };
        // l'ingresso audio eccita la voce 0 sulla nota del parametro
        const ext = channel(inputs.audio('in'), 0);
        if (ext) {
          const vo = voices[0]!;
          if (!vo.active || notes[0] !== ctx.discrete('pitch', 0)) {
            notes[0] = ctx.discrete('pitch', 0);
            setup(vo, notes[0], 1);
            vo.active = true;
          }
        }
        const events = framedEvents(ctx, inputs.control('note')?.events ?? []);
        let ei = 0;
        for (let i = 0; i < ctx.frames; i++) {
          const t = ctx.t0 + i / sr;
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind === 'gate' && !e.on) continue;
            const note = e.kind === 'note' ? e.pitch : e.kind === 'trig' ? (e.value ?? ctx.discrete('pitch', 0)) : ctx.discrete('pitch', 0);
            let k = -1;
            for (let j = 0; j < nv; j++) if (!voices[j]!.active && (k < 0 || voices[j]!.age < voices[k]!.age)) k = j;
            if (k < 0) for (let j = 0; j < nv; j++) if (k < 0 || voices[j]!.age < voices[k]!.age) k = j;
            const vo = voices[k]!;
            setup(vo, note, 1);
            notes[k] = note;
            vo.active = true;
            vo.quiet = 0;
            vo.age = ++counter;
            vo.vel = e.kind === 'gate' ? 1 : e.vel;
            vo.offAt = e.kind === 'note' ? t + e.dur : Infinity;
            vo.burstLen = exciter === 0 ? 1 : Math.max(1, Math.round((0.0005 + (1 - hard) * 0.006) * sr));
            vo.burst = vo.burstLen;
          }
          let sum = 0;
          for (let j = 0; j < nv; j++) {
            const vo = voices[j]!;
            if (!vo.active) continue;
            let x = 0;
            if (vo.burst > 0) {
              const ph = 1 - vo.burst / vo.burstLen;
              // energia del colpo simile per i tre tipi: impulso = 1, gli altri spalmati sulla durata
              x = exciter === 1 ? ((ctx.rng.float() * 2 - 1) * vo.vel * 2) / Math.sqrt(vo.burstLen) : exciter === 2 ? (Math.sin(Math.PI * ph) * vo.vel * Math.PI) / 2 / vo.burstLen * 4 : vo.vel;
              vo.burst--;
            }
            if (j === 0 && ext) x += ext[i]! * 0.05;
            if (t >= vo.offAt && release < 20) {
              // rilascio: i modi si smorzano più in fretta
              const r = Math.exp(-6.91 / (release * sr));
              for (let k = 0; k < count; k++) if (vo.a2[k]! > r * r) {
                const scale = r / Math.sqrt(vo.a2[k]!);
                vo.a1[k]! *= scale;
                vo.a2[k] = r * r;
              }
              vo.offAt = Infinity;
            }
            let y = 0;
            for (let k = 0; k < count; k++) {
              const b = vo.b0[k]!;
              if (!b) continue;
              const yk = b * x + vo.a1[k]! * vo.y1[k]! - vo.a2[k]! * vo.y2[k]!;
              vo.y2[k] = vo.y1[k]!;
              vo.y1[k] = yk;
              y += yk;
            }
            sum += y;
            vo.quiet = Math.abs(y) < 1e-5 && vo.burst === 0 ? vo.quiet + 1 : 0;
            if (vo.quiet > sr * 0.05 && !(j === 0 && ext)) {
              vo.active = false;
              vo.y1.fill(0);
              vo.y2.fill(0);
            }
          }
          out[i] = Math.tanh(sum * level * 0.5);
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default modal;
