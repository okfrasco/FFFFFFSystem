/**
 * Wavetable — scansione di una tavola di 32 fotogrammi: `position` sceglie il
 * fotogramma (con dissolvenza tra i vicini), `mod` lo muove al campione (un
 * inviluppo, un LFO audio). Tavole pronte (base, armonici, formanti,
 * dispari → pari, digitale, pulse) o da un campione caricato nel nodo
 * (fotogrammi consecutivi da 2048 campioni, come le tavole di Serum). Ogni
 * tavola ha livelli di banda per ottava: niente aliasing sulle note alte.
 */

import { channel, mtof } from '../../../core/dsp';
import { getSample, mono } from '../../../core/samples';
import type { ModuleDefinition } from '../../../core/types';
import { BUILTIN, TABLE_SIZE, builtin, levelFor, tableFromSamples, type Wavetable } from './tables';

export interface WavetableConfig {
  sample?: string;
  /** Campioni per fotogramma nel file. */
  frameSize?: number;
}

const fromFile = new Map<string, Wavetable>();

/** La tavola in uso (null = campione non ancora arrivato). */
export function currentTable(index: number, cfg: WavetableConfig): Wavetable | null {
  if (index < BUILTIN.length) return builtin(index);
  const s = getSample(cfg.sample);
  if (!s) return null;
  const key = `${s.id}:${cfg.frameSize ?? TABLE_SIZE}`;
  let t = fromFile.get(key);
  if (!t) fromFile.set(key, (t = tableFromSamples(s.name, mono(s), cfg.frameSize ?? TABLE_SIZE)));
  return t;
}

export const wavetable: ModuleDefinition = {
  manifest: {
    id: 'wavetable',
    name: 'Wavetable',
    category: 'audio',
    rate: 'audio',
    inputs: [
      { id: 'pitch', type: 'audio', poly: true },
      { id: 'mod', type: 'audio', poly: true },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'table', label: 'Tavola', min: 0, max: BUILTIN.length, default: 0, kind: 'discrete', options: [...BUILTIN.map((b) => b.name), 'campione'] },
      { id: 'position', label: 'Posizione', min: 0, max: 1, default: 0.3, kind: 'continuous' },
      { id: 'modDepth', label: 'Mod', min: -1, max: 1, default: 0.5, kind: 'continuous' },
      { id: 'pitch', label: 'Nota', min: 0, max: 127, default: 48, kind: 'continuous' },
      { id: 'transpose', label: 'Trasponi', min: -48, max: 48, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'fine', label: 'Fine', min: -100, max: 100, default: 0, kind: 'continuous', unit: 'ct' },
      { id: 'level', label: 'Livello', min: 0, max: 1, default: 0.5, kind: 'continuous' },
    ],
    seeded: false,
  },
  defaultConfig: {} satisfies WavetableConfig,
  create(init) {
    let cfg = init.config as WavetableConfig;
    const phase: number[] = [];
    return {
      process(ctx, inputs, outputs) {
        const pitchIn = inputs.audio('pitch');
        const modIn = inputs.audio('mod');
        const n = pitchIn?.channels.length ?? 1;
        const out = outputs.audio('out', n).channels;
        while (phase.length < n) phase.push(0);
        const table = currentTable(ctx.discrete('table', 0), cfg);
        if (!table) {
          for (const o of out) o.fill(0);
          return;
        }
        const frames = table.levels[0]!.length;
        const offset = ctx.param('transpose') + ctx.param('fine') / 100;
        const base = ctx.param('pitch');
        const pos = ctx.param('position');
        const depth = ctx.param('modDepth');
        const level = ctx.param('level');
        const sr = ctx.sampleRate;
        for (let v = 0; v < n; v++) {
          const pin = channel(pitchIn, v);
          const m = channel(modIn, v);
          const o = out[v]!;
          let ph = phase[v]!;
          let last = NaN;
          let freq = mtof(base + offset);
          let rows = table.levels[levelFor(freq, sr)]!;
          for (let i = 0; i < ctx.frames; i++) {
            if (pin && pin[i] !== last) {
              last = pin[i]!;
              freq = mtof(last + offset);
              rows = table.levels[levelFor(freq, sr)]!;
            }
            ph += freq / sr;
            ph -= Math.floor(ph);
            const fp = Math.max(0, Math.min(1, pos + (m ? depth * m[i]! : 0))) * (frames - 1);
            const f0 = Math.floor(fp);
            const f1 = Math.min(frames - 1, f0 + 1);
            const ff = fp - f0;
            const x = ph * TABLE_SIZE;
            const i0 = x | 0;
            const i1 = (i0 + 1) & (TABLE_SIZE - 1);
            const xf = x - i0;
            const A = rows[f0]!;
            const B = rows[f1]!;
            const a = A[i0]! + (A[i1]! - A[i0]!) * xf;
            const b = B[i0]! + (B[i1]! - B[i0]!) * xf;
            o[i] = (a + (b - a) * ff) * level;
          }
          phase[v] = ph;
        }
      },
      setConfig(c) {
        cfg = c as WavetableConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default wavetable;
