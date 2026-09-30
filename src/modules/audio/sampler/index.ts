/**
 * Sampler / Slicer — un campione suonato dalle note.
 *   sampler  la nota traspone (alla nota `root` suona com'è); si suona la
 *            zona tra `start` e `end`, una volta o in loop (avanti o avanti e
 *            indietro), con attacco e rilascio
 *   slicer   la zona è divisa in `slices` fette uguali: il valore del
 *            trigger (Steps, Markov…) o la distanza della nota da `root`
 *            sceglie la fetta, che suona alla sua altezza (più `transpose`)
 * Le note con durata si chiudono con il rilascio; i trigger suonano fino alla
 * fine della zona (o della fetta). Esce in stereo se il campione è stereo.
 */

import { framedEvents } from '../../../core/dsp';
import { getSample } from '../../../core/samples';
import type { ModuleDefinition } from '../../../core/types';

export interface SamplerConfig {
  sample?: string;
}

export const LOOPS = ['no', 'avanti', 'avanti e indietro'] as const;

interface Voice {
  active: boolean;
  pos: number;
  inc: number;
  from: number;
  to: number;
  loop: number;
  env: number;
  releasing: boolean;
  offAt: number;
  vel: number;
  age: number;
}

const newVoice = (): Voice => ({ active: false, pos: 0, inc: 1, from: 0, to: 0, loop: 0, env: 0, releasing: false, offAt: Infinity, vel: 1, age: 0 });

/** Zona [from, to) in campioni di una fetta (o della zona intera). */
export function sliceRange(length: number, start: number, end: number, slices: number, index: number): [number, number] {
  const a = Math.min(start, end) * length;
  const b = Math.max(start, end) * length;
  if (slices <= 1) return [a, b];
  const k = ((index % slices) + slices) % slices;
  const w = (b - a) / slices;
  return [a + k * w, a + (k + 1) * w];
}

export const sampler: ModuleDefinition = {
  manifest: {
    id: 'sampler',
    name: 'Sampler / Slicer',
    category: 'audio',
    rate: 'audio',
    inputs: [{ id: 'note', type: 'control', signal: 'event', poly: true }],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['sampler', 'slicer'] },
      { id: 'root', label: 'Nota base', min: 0, max: 127, default: 60, kind: 'discrete' },
      { id: 'start', label: 'Inizio', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'end', label: 'Fine', min: 0, max: 1, default: 1, kind: 'continuous' },
      { id: 'slices', label: 'Fette', min: 1, max: 64, default: 8, kind: 'discrete' },
      { id: 'loop', label: 'Loop', min: 0, max: 2, default: 0, kind: 'discrete', options: [...LOOPS] },
      { id: 'reverse', label: 'Al contrario', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'transpose', label: 'Trasponi', min: -24, max: 24, default: 0, kind: 'continuous', unit: 'st' },
      { id: 'attack', label: 'Attacco', min: 0.001, max: 2, default: 0.002, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'release', label: 'Rilascio', min: 0.005, max: 4, default: 0.05, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'voices', label: 'Voci', min: 1, max: 16, default: 8, kind: 'discrete' },
      { id: 'level', label: 'Livello', min: 0, max: 1.5, default: 0.8, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: {} satisfies SamplerConfig,
  create(init) {
    let cfg = init.config as SamplerConfig;
    const voices: Voice[] = [];
    let counter = 0;
    return {
      process(ctx, inputs, outputs) {
        const s = getSample(cfg.sample);
        const nch = s ? s.channels.length : 1;
        const out = outputs.audio('out', nch).channels;
        for (const o of out) o.fill(0);
        if (!s) return;
        const sr = ctx.sampleRate;
        const len = s.channels[0]!.length;
        const nv = ctx.discrete('voices', 0);
        while (voices.length < nv) voices.push(newVoice());
        const slicer = ctx.discrete('mode', 0) === 1;
        const root = ctx.discrete('root', 0);
        const slices = slicer ? ctx.discrete('slices', 0) : 1;
        const start = ctx.param('start');
        const end = ctx.param('end');
        const loop = ctx.discrete('loop', 0);
        const reverse = ctx.discrete('reverse', 0) === 1;
        const transpose = ctx.param('transpose');
        const atk = 1 / (ctx.param('attack') * sr);
        const rel = 1 - Math.exp(-4.6 / (ctx.param('release') * sr));
        const level = ctx.param('level');
        const baseInc = s.sampleRate / sr;
        const events = framedEvents(ctx, inputs.control('note')?.events ?? []);
        let ei = 0;
        for (let i = 0; i < ctx.frames; i++) {
          const t = ctx.t0 + i / sr;
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind === 'gate' && !e.on) continue;
            let k = -1;
            for (let j = 0; j < nv; j++) if (!voices[j]!.active && (k < 0 || voices[j]!.age < voices[k]!.age)) k = j;
            if (k < 0) for (let j = 0; j < nv; j++) if (k < 0 || voices[j]!.age < voices[k]!.age) k = j;
            const vo = voices[k]!;
            const note = e.kind === 'note' ? e.pitch : e.kind === 'trig' && e.value !== undefined && !slicer ? e.value : root;
            const index = slicer ? (e.kind === 'trig' && e.value !== undefined ? Math.floor(e.value) : Math.round(note - root)) : 0;
            const [from, to] = sliceRange(len, start, end, slices, index);
            const semis = (slicer ? 0 : note - root) + transpose;
            vo.inc = baseInc * Math.pow(2, semis / 12) * (reverse ? -1 : 1);
            vo.from = from;
            vo.to = to;
            vo.pos = reverse ? to - 1 : from;
            vo.loop = loop;
            vo.env = 0;
            vo.releasing = false;
            vo.active = true;
            vo.vel = e.kind === 'gate' ? 1 : e.vel;
            vo.offAt = e.kind === 'note' ? t + e.dur : Infinity;
            vo.age = ++counter;
          }
          for (let j = 0; j < nv; j++) {
            const vo = voices[j]!;
            if (!vo.active) continue;
            if (t >= vo.offAt) vo.releasing = true;
            vo.env = vo.releasing ? vo.env - vo.env * rel : Math.min(1, vo.env + atk);
            // fine della zona: loop o fine della voce
            if (vo.pos >= vo.to || vo.pos < vo.from) {
              if (vo.loop === 1) vo.pos = vo.inc > 0 ? vo.from + (vo.pos - vo.to) : vo.to + (vo.pos - vo.from) - 1;
              else if (vo.loop === 2) {
                vo.inc = -vo.inc;
                vo.pos = Math.max(vo.from, Math.min(vo.to - 1, vo.pos + 2 * vo.inc));
              } else {
                vo.active = false;
                continue;
              }
            }
            if (vo.releasing && vo.env < 1e-4) {
              vo.active = false;
              continue;
            }
            const x0 = Math.floor(vo.pos);
            const fr = vo.pos - x0;
            // micro dissolvenza ai bordi della zona (niente click sulle fette)
            const edge = Math.min(1, (vo.pos - vo.from) / 32, (vo.to - vo.pos) / 32);
            const g = vo.env * vo.vel * level * (vo.loop ? 1 : Math.max(0, edge));
            for (let c = 0; c < nch; c++) {
              const ch = s.channels[c]!;
              const a = ch[x0] ?? 0;
              const b = ch[x0 + 1] ?? a;
              out[c]![i]! += (a + (b - a) * fr) * g;
            }
            vo.pos += vo.inc;
          }
        }
      },
      setConfig(c) {
        cfg = c as SamplerConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default sampler;
