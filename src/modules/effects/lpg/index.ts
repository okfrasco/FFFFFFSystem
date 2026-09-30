/**
 * Low-pass gate — filtro e VCA mossi insieme da un "vactrol": sale in fretta
 * e ricade lento (più lento quando è quasi chiuso), come nei Buchla. Si apre
 * con un gate audio (`gate`, da Voci) o con un colpo (`trig`, eventi): nel
 * secondo caso fa "ping", un suono percussivo e morbido.
 * Modo: combo (filtro + VCA), solo filtro, solo VCA.
 */

import { channel, framedEvents } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const LPG_MODES = ['combo', 'filtro', 'VCA'] as const;

export const lpg: ModuleDefinition = {
  manifest: {
    id: 'lpg',
    name: 'Low-pass gate',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'gate', type: 'audio', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    outputs: [
      { id: 'out', type: 'audio', poly: true },
      { id: 'level', type: 'audio', poly: true },
    ],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: 2, default: 0, kind: 'discrete', options: [...LPG_MODES] },
      { id: 'decay', label: 'Ricaduta', min: 0.02, max: 4, default: 0.35, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'offset', label: 'Apertura base', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'resonance', label: 'Risonanza', min: 0, max: 0.9, default: 0.2, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    const st: Float64Array[] = [];
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const gateIn = inputs.audio('gate');
        const n = Math.max(input?.channels.length ?? 1, gateIn?.channels.length ?? 1);
        const out = outputs.audio('out', n).channels;
        const lev = outputs.audio('level', n).channels;
        while (st.length < n) st.push(new Float64Array(3));
        const sr = ctx.sampleRate;
        const mode = ctx.discrete('mode', 0);
        const decay = ctx.param('decay');
        const offset = ctx.param('offset');
        const k = 2 - 1.9 * ctx.param('resonance');
        const attack = 1 - Math.exp(-1 / (0.004 * sr));
        const events = framedEvents(ctx, inputs.control('trig')?.events ?? []);
        for (let v = 0; v < n; v++) {
          const x = channel(input, v);
          const gt = channel(gateIn, v);
          const o = out[v]!;
          const L = lev[v]!;
          const s = st[v]!;
          let c = s[0]!;
          let ic1 = s[1]!;
          let ic2 = s[2]!;
          let ei = 0;
          for (let i = 0; i < ctx.frames; i++) {
            while (ei < events.length && events[ei]!.f === i) {
              const e = events[ei++]!.e;
              if ((e.voice % n === v || n === 1) && (e.kind !== 'gate' || e.on)) c = Math.min(1.2, c + (e.kind === 'gate' ? 1 : e.vel));
            }
            const target = gt ? (gt[i]! > 0.5 ? 1 : 0) : 0;
            if (target > c) c += (target - c) * attack;
            else {
              // ricaduta del vactrol: più lenta man mano che si chiude
              const rate = 1 - Math.exp(-1 / (decay * sr * (1 + (1 - Math.min(1, c)) * 2)));
              c += (target - c) * rate;
            }
            const lvl = Math.min(1, offset + (1 - offset) * c);
            L[i] = lvl;
            const xin = x ? x[i]! : 0;
            let y = xin;
            if (mode !== 2) {
              const fc = 30 * Math.pow(600, lvl);
              const g = Math.tan((Math.PI * Math.min(0.45 * sr, fc)) / sr);
              const a1 = 1 / (1 + g * (g + k));
              const a2 = g * a1;
              const a3 = g * a2;
              const v3 = xin - ic2;
              const v1 = a1 * ic1 + a2 * v3;
              const v2 = ic2 + a2 * ic1 + a3 * v3;
              ic1 = 2 * v1 - ic1;
              ic2 = 2 * v2 - ic2;
              y = v2;
            }
            if (mode !== 1) y *= lvl * Math.sqrt(lvl);
            o[i] = y;
          }
          s[0] = c;
          s[1] = Number.isFinite(ic1) ? ic1 : 0;
          s[2] = Number.isFinite(ic2) ? ic2 : 0;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default lpg;
