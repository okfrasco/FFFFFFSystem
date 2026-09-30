/**
 * Granulare — nuvole di grani (frammenti con finestra di Hann) presi da un
 * campione o dall'ingresso dal vivo (gli ultimi 4 secondi). `density` grani
 * al secondo, più uno per ogni trigger su `trig`; ognuno parte da `position`
 * (nel campione: 0 = inizio, 1 = fine; dal vivo: 0 = adesso, 1 = 4 s fa) più
 * un po' di caso (`spray`), dura `size`, è trasposto di `pitch` (più
 * `pitchRand`), a volte al contrario, e si apre nello stereo con `spread`.
 * `freeze` ferma la registrazione dal vivo: i grani girano su ciò che c'è.
 */

import { channel, fastSin, framedEvents } from '../../../core/dsp';
import { getSample, mono, type Sample } from '../../../core/samples';
import type { ModuleDefinition } from '../../../core/types';

export interface GranularConfig {
  sample?: string;
}

const LIVE_SECONDS = 4;

/** Il campione in mono, calcolato una volta sola. */
const monoCache = new WeakMap<Sample, Float32Array>();
function monoOf(s: Sample): Float32Array {
  let m = monoCache.get(s);
  if (!m) monoCache.set(s, (m = mono(s)));
  return m;
}
const MAX_GRAINS = 64;

interface Grain {
  pos: number;
  inc: number;
  age: number;
  len: number;
  gl: number;
  gr: number;
}

export const granular: ModuleDefinition = {
  manifest: {
    id: 'granular',
    name: 'Granulare',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'trig', type: 'control', signal: 'event', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'source', label: 'Sorgente', min: 0, max: 1, default: 0, kind: 'discrete', options: ['campione', 'ingresso'] },
      { id: 'position', label: 'Posizione', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'spray', label: 'Spray', min: 0, max: 1, default: 0.05, kind: 'continuous' },
      { id: 'size', label: 'Grandezza', min: 0.005, max: 0.5, default: 0.08, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'density', label: 'Densità', min: 0, max: 200, default: 20, kind: 'continuous', unit: '/s' },
      { id: 'pitch', label: 'Trasponi', min: -24, max: 24, default: 0, kind: 'continuous', unit: 'st' },
      { id: 'pitchRand', label: 'Pitch a caso', min: 0, max: 12, default: 0, kind: 'continuous', unit: 'st' },
      { id: 'reverse', label: 'Al contrario', min: 0, max: 1, default: 0, kind: 'continuous' },
      { id: 'spread', label: 'Stereo', min: 0, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'freeze', label: 'Freeze', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.6, kind: 'continuous' },
    ],
    seeded: true,
  },
  defaultConfig: {} satisfies GranularConfig,
  create(init) {
    let cfg = init.config as GranularConfig;
    const grains: Grain[] = [];
    let live: Float32Array | null = null;
    let lw = 0;
    let acc = 0;
    return {
      process(ctx, inputs, outputs) {
        const sr = ctx.sampleRate;
        const out = outputs.audio('out', 2).channels;
        const L = out[0]!;
        const R = out[1]!;
        L.fill(0);
        R.fill(0);
        const fromLive = ctx.discrete('source', 0) === 1;
        const input = inputs.audio('in');
        if (!live) live = new Float32Array(Math.ceil(LIVE_SECONDS * sr));
        // registrazione dal vivo (sempre, tranne in freeze)
        const frozen = ctx.discrete('freeze', 0) === 1;
        if (!frozen && input) {
          const n = input.channels.length;
          for (let i = 0; i < ctx.frames; i++) {
            let x = 0;
            for (let v = 0; v < n; v++) x += channel(input, v)![i]!;
            live[lw] = x / n;
            lw = lw + 1 === live.length ? 0 : lw + 1;
          }
        }
        const sample = fromLive ? null : getSample(cfg.sample);
        const src = fromLive ? live : sample ? monoOf(sample) : null;
        if (!src) return;
        const srcRate = fromLive ? 1 : sample!.sampleRate / sr;
        const size = ctx.param('size');
        const density = ctx.param('density');
        const pos = ctx.param('position');
        const spray = ctx.param('spray');
        const pitch = ctx.param('pitch');
        const pRand = ctx.param('pitchRand');
        const rev = ctx.param('reverse');
        const spread = ctx.param('spread');
        const level = ctx.param('level');
        const rng = ctx.rng;
        const gain = level / Math.sqrt(Math.max(1, density * size));
        // posizione di scrittura al campione i del blocco (la registrazione del blocco è già fatta)
        const writeAt = (i: number) => lw - ctx.frames + i;
        const spawn = (i: number) => {
          if (grains.length >= MAX_GRAINS) return;
          const len = Math.max(16, Math.round(size * sr));
          const ratio = Math.pow(2, (pitch + (rng.float() * 2 - 1) * pRand) / 12) * srcRate * (rng.chance(rev) ? -1 : 1);
          const p = Math.max(0, Math.min(1, pos + (rng.float() * 2 - 1) * spray));
          let start: number;
          if (fromLive) {
            // dal vivo: indietro nel tempo, lasciando spazio al grano se va avanti
            const back = p * (src.length - len * Math.abs(ratio) - 2) + (ratio > 0 ? len * ratio : 0);
            start = writeAt(i) - back;
          } else start = p * (src.length - 1);
          const pan = 0.5 + (rng.float() - 0.5) * spread;
          grains.push({ pos: start, inc: ratio, age: 0, len, gl: Math.cos((pan * Math.PI) / 2), gr: Math.sin((pan * Math.PI) / 2) });
        };
        const events = framedEvents(ctx, inputs.control('trig')?.events ?? []);
        let ei = 0;
        const size0 = src.length;
        for (let i = 0; i < ctx.frames; i++) {
          while (ei < events.length && events[ei]!.f === i) {
            const e = events[ei++]!.e;
            if (e.kind !== 'gate' || e.on) spawn(i);
          }
          acc += density / sr;
          while (acc >= 1) {
            acc -= 1;
            spawn(i);
          }
          let l = 0;
          let r = 0;
          for (let k = grains.length - 1; k >= 0; k--) {
            const g = grains[k]!;
            let x = g.pos;
            if (fromLive) x = ((x % size0) + size0) % size0;
            else if (x < 0 || x >= size0 - 1) {
              g.age = g.len;
            }
            if (g.age < g.len) {
              const x0 = Math.floor(x);
              const fr = x - x0;
              const s = src[x0]! + ((src[(x0 + 1) % size0] ?? 0) - src[x0]!) * fr;
              // finestra di Hann
              const wv = 0.5 - 0.5 * fastSin(g.age / g.len + 0.25);
              const y = s * wv * gain;
              l += y * g.gl;
              r += y * g.gr;
              g.pos += g.inc;
              g.age++;
            }
            if (g.age >= g.len) grains.splice(k, 1);
          }
          L[i] = l;
          R[i] = r;
        }
      },
      setConfig(c) {
        cfg = c as GranularConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default granular;
