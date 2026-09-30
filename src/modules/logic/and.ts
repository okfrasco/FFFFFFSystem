/**
 * AND — lascia passare un colpo quando anche l'altro ingresso è acceso.
 *
 * Ogni ingresso è di uno di due tipi, deciso da ciò che riceve:
 * - flusso di eventi (trigger, note, gate): è acceso solo nell'istante in cui
 *   colpisce. Due flussi danno un colpo dove coincidono entro `window` secondi,
 *   e due colpi quasi simultanei diventano uno solo;
 * - livello (un gate tenuto, un valore): è acceso quando vale almeno 0.5. Un
 *   colpo dell'altro ingresso passa se in quel momento il livello è alto.
 * Due livelli danno solo un livello in uscita (A e B alti), senza colpi.
 */

import type { ControlBuffer, ControlEvent, ModuleDefinition, TrigEvent } from '../../core/types';

interface AndState {
  /** L'ingresso ha mai portato eventi: da lì in poi è un flusso di eventi. */
  eventfulA: boolean;
  eventfulB: boolean;
}

/** Accensioni di una voce; un ingresso mono vale per tutte le voci. */
function onsFor(buf: ControlBuffer | undefined, v: number): ControlEvent[] {
  if (!buf) return [];
  const n = buf.values.length;
  return buf.events.filter((e) => (n === 1 || e.voice % n === v % n) && (e.kind !== 'gate' || e.on));
}

function levelOf(buf: ControlBuffer | undefined, v: number): boolean {
  if (!buf) return false;
  return (buf.values[v % buf.values.length] ?? 0) >= 0.5;
}

export const and: ModuleDefinition = {
  manifest: {
    id: 'and',
    name: 'AND',
    category: 'logic',
    rate: 'control',
    inputs: [
      { id: 'a', type: 'control', signal: 'value', poly: true },
      { id: 'b', type: 'control', signal: 'value', poly: true },
    ],
    outputs: [{ id: 'trig', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'window', label: 'Finestra', min: 0.0005, max: 0.05, default: 0.002, kind: 'continuous', curve: 'exp', unit: 's' },
    ],
    seeded: false,
  },

  create() {
    let s: AndState = { eventfulA: false, eventfulB: false };
    return {
      process(ctx, inputs, outputs) {
        const a = inputs.control('a');
        const b = inputs.control('b');
        if (a?.events.length) s.eventfulA = true;
        if (b?.events.length) s.eventfulB = true;
        const voices = Math.max(a?.values.length ?? 1, b?.values.length ?? 1);
        const out = outputs.control('trig', voices);
        for (let v = 0; v < voices; v++) {
          const win = ctx.param('window', v);
          const onA = onsFor(a, v);
          const onB = onsFor(b, v);
          const candidates: TrigEvent[] = [];
          if (s.eventfulA && s.eventfulB) {
            for (const e of onA) {
              const match = onB.find((x) => Math.abs(x.t - e.t) <= win);
              if (match) candidates.push(toTrig(e.t <= match.t ? e : match, v));
            }
          } else if (s.eventfulA) {
            if (levelOf(b, v)) for (const e of onA) candidates.push(toTrig(e, v));
          } else if (s.eventfulB) {
            if (levelOf(a, v)) for (const e of onB) candidates.push(toTrig(e, v));
          }
          candidates.sort((x, y) => x.t - y.t);
          let last = -Infinity;
          for (const c of candidates) {
            if (c.t - last <= win) continue;
            out.events.push(c);
            last = c.t;
          }
          out.values[v] = levelOf(a, v) && levelOf(b, v) ? 1 : 0;
        }
        out.events.sort((x, y) => x.t - y.t);
      },
      getState: () => ({ ...s }),
      setState(state) {
        s = { ...(state as AndState) };
      },
    };
  },
};

function toTrig(e: ControlEvent, voice: number): TrigEvent {
  const trig: TrigEvent = { kind: 'trig', t: e.t, voice, vel: e.kind === 'gate' ? 1 : e.vel };
  const value = e.kind === 'trig' ? e.value : e.kind === 'note' ? e.pitch : undefined;
  if (value !== undefined) trig.value = value;
  return trig;
}
