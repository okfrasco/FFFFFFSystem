/**
 * MIDI Clip — le note di un file MIDI lette dalla fase. La posizione nella
 * clip è fase × `beats` (beat per ciclo: 4 = una battuta per ciclo di
 * Transport.bar), e la clip si ripete ogni sua lunghezza. Piegare la fase
 * piega la clip: Ø Bend la fa respirare, una fase al contrario la suona da
 * destra a sinistra, una fase lenta la stira (anche le durate).
 * Il file si carica dal nodo; le note restano nella patch.
 */

import { phaseAt } from '../../../core/phase';
import type { ModuleDefinition } from '../../../core/types';
import type { ClipNote } from './smf';

export interface MidiClipConfig {
  name: string;
  notes: ClipNote[];
  /** Lunghezza della clip in beat. */
  length: number;
  tracks: number;
}

/** Istanti srotolati (in beat) a cui la nota che parte da `s` scatta tra a e b. */
export function noteCrossings(s: number, length: number, a: number, b: number): number[] {
  const out: number[] = [];
  if (!(length > 0) || a === b) return out;
  if (b > a) {
    for (let k = Math.ceil((a - s) / length); s + k * length < b; k++) out.push(s + k * length);
  } else {
    for (let k = Math.floor((a - s) / length); s + k * length > b; k--) out.push(s + k * length);
  }
  return out;
}

export const midiClip: ModuleDefinition = {
  manifest: {
    id: 'midiClip',
    name: 'MIDI Clip',
    category: 'data',
    rate: 'control',
    inputs: [{ id: 'phase', type: 'phase' }],
    outputs: [
      { id: 'note', type: 'control', signal: 'event', poly: true },
      { id: 'pos', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'beats', label: 'Beat per ciclo', min: 0.25, max: 16, default: 4, kind: 'continuous', curve: 'exp' },
      { id: 'transpose', label: 'Trasponi', min: -24, max: 24, default: 0, kind: 'discrete', unit: 'st' },
      { id: 'vel', label: 'Velocity', min: 0, max: 2, default: 1, kind: 'continuous' },
      { id: 'track', label: 'Traccia', min: 0, max: 16, default: 0, kind: 'discrete' },
    ],
    seeded: false,
  },
  defaultConfig: {
    name: 'esempio',
    length: 8,
    tracks: 1,
    notes: [
      [0, 0.5, 60, 0.9, 0], [0.75, 0.25, 63, 0.6, 0], [1, 0.5, 67, 0.8, 0], [1.5, 0.5, 70, 0.6, 0],
      [2.5, 0.25, 72, 0.7, 0], [3, 1, 67, 0.8, 0], [4, 0.5, 58, 0.9, 0], [4.75, 0.25, 62, 0.6, 0],
      [5, 0.5, 65, 0.8, 0], [5.5, 0.5, 69, 0.6, 0], [6.5, 0.5, 70, 0.7, 0], [7, 0.75, 65, 0.8, 0],
    ],
  } satisfies MidiClipConfig,
  create(init) {
    let clip = init.config as MidiClipConfig;
    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const start = ph.start[0]!;
        const end = ph.end[0]!;
        // arrotondato: la curva esponenziale restituisce 4.000000000000001, e la clip scivolerebbe
        const beats = Math.round(ctx.param('beats') * 1e6) / 1e6;
        const a = start * beats;
        const b = end * beats;
        const L = clip.length;
        const note = outputs.control('note');
        const beatsPerSec = (Math.abs(end - start) * beats) / Math.max(1e-9, ctx.dt);
        const track = ctx.discrete('track', Math.floor(start));
        const transpose = ctx.discrete('transpose', Math.floor(start));
        for (const [s, dur, pitch, vel, tr] of clip.notes) {
          if (track > 0 && tr !== track - 1) continue;
          for (const x of noteCrossings(s, L, a, b)) {
            note.events.push({
              kind: 'note',
              t: phaseAt(ctx.t0, ctx.t1, a, b, x),
              voice: 0,
              pitch: pitch + transpose,
              vel: Math.min(1, vel * ctx.param('vel')),
              dur: beatsPerSec > 0 ? dur / beatsPerSec : 0.1,
            });
          }
        }
        note.events.sort((p, q) => p.t - q.t);
        outputs.control('pos').values[0] = L > 0 ? (((b % L) + L) % L) / L : 0;
      },
      setConfig(c) {
        clip = c as MidiClipConfig;
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default midiClip;
