/**
 * Tuning — microtonalità: ogni tasto (nota MIDI intera) diventa un grado di
 * un'accordatura, con `base` come tasto che resta fermo. Accordature pronte
 * (giusta, pitagorica, armonici, 19/24/31-TET, Bohlen-Pierce, slendro,
 * pelog) oppure un file Scala (.scl) caricato nel nodo. Le altezze escono
 * frazionarie: Voci e gli oscillatori le suonano così.
 * Scale con più o meno di 12 note cambiano la tastiera: con 19-TET 19 tasti
 * fanno un'ottava.
 */

import type { ModuleDefinition } from '../../../core/types';
import { readChord } from '../theory';
import { PRESETS, tune, type Tuning } from './scala';

export interface TuningConfig {
  /** Accordatura da file (usata con preset = "file"). */
  file?: Tuning;
}

export const tuning: ModuleDefinition = {
  manifest: {
    id: 'tuning',
    name: 'Tuning',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'chord', type: 'control', signal: 'value', poly: true },
    ],
    outputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'chord', type: 'control', signal: 'value', poly: true },
    ],
    params: [
      { id: 'preset', label: 'Accordatura', min: 0, max: PRESETS.length, default: 1, kind: 'discrete', options: [...PRESETS.map((p) => p.name), 'file'] },
      { id: 'base', label: 'Tasto fermo', min: 0, max: 127, default: 60, kind: 'discrete' },
    ],
    seeded: false,
  },
  defaultConfig: {} satisfies TuningConfig,
  create(init) {
    let cfg = init.config as TuningConfig;
    const current = (i: number): Tuning => (i >= PRESETS.length ? (cfg.file ?? PRESETS[0]!) : PRESETS[i]!);
    return {
      process(ctx, inputs, outputs) {
        const t = current(ctx.discrete('preset', 0));
        const base = ctx.discrete('base', 0);
        const input = inputs.control('note');
        const out = outputs.control('note', input?.values.length ?? 1);
        for (const e of input?.events ?? []) {
          if (e.kind === 'note') out.events.push({ ...e, pitch: tune(e.pitch, base, t) });
          else if (e.kind === 'trig' && e.value !== undefined) out.events.push({ ...e, value: tune(e.value, base, t) });
          else out.events.push(e);
        }
        const chord = readChord(inputs.control('chord'));
        if (chord.length) {
          const c = outputs.control('chord', chord.length);
          chord.forEach((p, i) => (c.values[i] = tune(p, base, t)));
        }
      },
      setConfig(c) {
        cfg = c as TuningConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default tuning;
