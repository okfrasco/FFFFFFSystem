/**
 * Voice leading — prende un accordo dal campo e sceglie il voicing a N voci
 * più vicino al precedente (somma dei movimenti minima), dentro un registro.
 * Con `bass` il basso dell'accordo in ingresso resta sotto, a parte. Suona le
 * note a ogni cambio d'accordo, oppure a ogni trigger (per ribattere o
 * strimpellare con `strum`).
 */

import type { ControlEvent, ModuleDefinition } from '../../../core/types';
import { pc, readChord, sameNotes, voiceLead } from '../theory';

interface LeadState {
  input: number[];
  voicing: number[];
}

export const voiceLeadNode: ModuleDefinition = {
  manifest: {
    id: 'voiceLead',
    name: 'Voice leading',
    category: 'harmony',
    rate: 'control',
    inputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'chord', type: 'control', signal: 'value', poly: true },
      { id: 'note', type: 'control', signal: 'event', poly: true },
    ],
    params: [
      { id: 'voices', label: 'Voci', min: 2, max: 6, default: 4, kind: 'discrete' },
      { id: 'lo', label: 'Registro da', min: 36, max: 72, default: 52, kind: 'discrete' },
      { id: 'hi', label: 'Registro a', min: 60, max: 96, default: 76, kind: 'discrete' },
      { id: 'bass', label: 'Basso a parte', min: 0, max: 1, default: 1, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'play', label: 'Suona', min: 0, max: 1, default: 0, kind: 'discrete', options: ['al cambio', 'ai trigger'] },
      { id: 'length', label: 'Durata', min: 0.05, max: 8, default: 1.5, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'strum', label: 'Strum', min: 0, max: 0.1, default: 0, kind: 'continuous', unit: 's' },
      { id: 'vel', label: 'Velocity', min: 0.05, max: 1, default: 0.6, kind: 'continuous' },
    ],
    seeded: false,
  },
  create() {
    let s: LeadState = { input: [], voicing: [] };
    return {
      process(ctx, inputs, outputs) {
        const input = readChord(inputs.control('chord'));
        const withBass = ctx.discrete('bass', 0) === 1 && input.length > 1;
        const lo = ctx.discrete('lo', 0);
        const hi = Math.max(lo + 12, ctx.discrete('hi', 0));
        const changed = input.length > 0 && !sameNotes(input, s.input);
        if (changed) {
          const upper = withBass ? input.slice(1) : input;
          const pcs = [...new Set(upper.map(pc))];
          const voiced = voiceLead(withBass ? s.voicing.slice(1) : s.voicing, pcs, ctx.discrete('voices', 0), lo, hi);
          s = { input: [...input], voicing: withBass ? [input[0]!, ...voiced] : voiced };
        }
        const out = outputs.control('chord', Math.max(1, s.voicing.length));
        s.voicing.forEach((p, i) => (out.values[i] = p));

        const note = outputs.control('note', Math.max(1, s.voicing.length));
        const play = (t: number, vel: number) => {
          const strum = ctx.param('strum');
          s.voicing.forEach((p, i) => {
            const e: ControlEvent = { kind: 'note', t: t + i * strum, voice: i, pitch: p, vel, dur: ctx.param('length') };
            note.events.push(e);
          });
        };
        if (ctx.discrete('play', 0) === 0) {
          if (changed) play(ctx.t0, ctx.param('vel'));
        } else {
          for (const e of inputs.control('trig')?.events ?? []) {
            if (e.kind === 'gate' && !e.on) continue;
            play(e.t, e.kind === 'gate' ? ctx.param('vel') : e.vel * ctx.param('vel'));
          }
        }
        note.events.sort((a, b) => a.t - b.t);
      },
      getState: () => ({ input: [...s.input], voicing: [...s.voicing] }),
      setState(state) {
        const st = state as LeadState;
        s = { input: [...st.input], voicing: [...st.voicing] };
      },
    };
  },
};

export default voiceLeadNode;
