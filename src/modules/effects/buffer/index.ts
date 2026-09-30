/**
 * Buffer — tiene gli ultimi secondi di ciò che entra e, quando si attiva
 * (gate `hold` alto, trigger su `trig` che alterna, o il parametro Attivo),
 * suona da lì invece che dal vivo:
 *   repeat     ripete l'ultimo pezzo lungo `length` (stutter)
 *   reverse    lo stesso pezzo al contrario
 *   tape stop  il nastro rallenta fino a fermarsi in `stopTime`
 * Entrate e uscite in dissolvenza (5 ms): niente click. `length` si può dare
 * come divisione del beat con il BPM (ingresso `bpm` o parametro).
 */

import { channel, framedEvents } from '../../../core/dsp';
import type { ModuleDefinition } from '../../../core/types';

export const BUFFER_MODES = ['repeat', 'reverse', 'tape stop'] as const;
const SECONDS = 4;

interface BufState {
  bufs: Float32Array[];
  w: number;
  active: boolean;
  toggled: boolean;
  /** Punto di scrittura quando si è attivato. */
  anchor: number;
  pos: number;
  rate: number;
  fade: number;
}

export const buffer: ModuleDefinition = {
  manifest: {
    id: 'buffer',
    name: 'Buffer',
    category: 'effects',
    rate: 'audio',
    inputs: [
      { id: 'in', type: 'audio', poly: true },
      { id: 'hold', type: 'control' },
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'bpm', type: 'control', signal: 'value' },
    ],
    outputs: [{ id: 'out', type: 'audio', poly: true }],
    params: [
      { id: 'mode', label: 'Modo', min: 0, max: BUFFER_MODES.length - 1, default: 0, kind: 'discrete', options: [...BUFFER_MODES] },
      { id: 'active', label: 'Attivo', min: 0, max: 1, default: 0, kind: 'discrete', options: ['no', 'sì'] },
      { id: 'length', label: 'Lunghezza', min: 0.01, max: 2, default: 0.125, kind: 'continuous', curve: 'exp', unit: 's' },
      { id: 'beats', label: 'In beat', min: 0, max: 4, default: 0, kind: 'continuous', unit: 'beat' },
      { id: 'bpm', label: 'BPM', min: 20, max: 300, default: 120, kind: 'continuous' },
      { id: 'stopTime', label: 'Tape stop', min: 0.05, max: 4, default: 0.6, kind: 'continuous', curve: 'exp', unit: 's' },
    ],
    seeded: false,
  },
  create() {
    const s: BufState = { bufs: [], w: 0, active: false, toggled: false, anchor: 0, pos: 0, rate: 1, fade: 0 };
    return {
      process(ctx, inputs, outputs) {
        const input = inputs.audio('in');
        const n = Math.min(2, input?.channels.length ?? 1);
        const sr = ctx.sampleRate;
        const size = Math.ceil(SECONDS * sr);
        if (s.bufs.length !== n || s.bufs[0]!.length !== size) {
          s.bufs = Array.from({ length: n }, () => new Float32Array(size));
          s.w = 0;
        }
        const out = outputs.audio('out', n).channels;
        const mode = ctx.discrete('mode', 0);
        const bpmIn = inputs.control('bpm');
        const bpm = Math.max(20, bpmIn ? bpmIn.values[0]! : ctx.param('bpm'));
        const beats = ctx.param('beats');
        const len = Math.max(16, Math.min(size / 2, Math.round((beats > 0 ? (beats * 60) / bpm : ctx.param('length')) * sr)));
        const stopRate = 1 / (ctx.param('stopTime') * sr);
        const fadeStep = 1 / (0.005 * sr);
        const hold = inputs.control('hold');
        const trigs = framedEvents(ctx, inputs.control('trig')?.events ?? []);
        const holdHigh = (hold?.values[0] ?? 0) > 0.5;
        const holdEvents = framedEvents(ctx, hold?.events ?? []);
        let he = 0;
        let hLevel = holdEvents.length ? !holdHigh : holdHigh;
        let te = 0;
        const xs = Array.from({ length: n }, (_, v) => channel(input, v));
        for (let i = 0; i < ctx.frames; i++) {
          while (he < holdEvents.length && holdEvents[he]!.f === i) {
            const e = holdEvents[he++]!.e;
            hLevel = e.kind === 'gate' ? e.on : true;
          }
          while (te < trigs.length && trigs[te]!.f === i) {
            const e = trigs[te++]!.e;
            if (e.kind !== 'gate' || e.on) s.toggled = !s.toggled;
          }
          const want = ctx.discrete('active', 0) === 1 || hLevel || s.toggled;
          if (want && !s.active) {
            s.active = true;
            s.anchor = s.w;
            s.pos = 0;
            s.rate = 1;
          } else if (!want && s.active) s.active = false;
          s.fade = Math.max(0, Math.min(1, s.fade + (s.active ? fadeStep : -fadeStep)));
          for (let v = 0; v < n; v++) {
            const dry = xs[v] ? xs[v]![i]! : 0;
            const buf = s.bufs[v]!;
            buf[s.w] = dry;
            let wet = 0;
            if (s.fade > 0) {
              let r: number;
              if (mode === 2) r = s.anchor - (s.pos > 0 ? 0 : 0) + s.pos - s.w * 0;
              else {
                const k = s.pos % len;
                r = mode === 0 ? s.anchor - len + k : s.anchor - 1 - k;
              }
              if (mode === 2) r = s.anchor + s.pos - (s.w >= s.anchor ? s.w - s.anchor : s.w + size - s.anchor);
              r = ((r % size) + size) % size;
              const r0 = Math.floor(r);
              const fr = r - r0;
              wet = buf[r0]! * (1 - fr) + buf[(r0 + 1) % size]! * fr;
              // piccola dissolvenza ai bordi del pezzo ripetuto
              if (mode !== 2) {
                const k = s.pos % len;
                const edge = Math.min(1, k / 64, (len - k) / 64);
                wet *= edge;
              } else wet *= Math.min(1, s.rate * 4);
            }
            out[v]![i] = dry * (1 - s.fade) + wet * s.fade;
          }
          if (s.active || s.fade > 0) {
            if (mode === 2) {
              s.pos += s.rate;
              s.rate = Math.max(0, s.rate - stopRate);
            } else s.pos += 1;
          }
          s.w = s.w + 1 === size ? 0 : s.w + 1;
        }
      },
      getState: () => null,
      setState() {},
    };
  },
};

export default buffer;
