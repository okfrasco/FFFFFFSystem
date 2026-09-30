/**
 * Memoria — ricorda gli ultimi eventi e li ripete mutandoli invece di loopare.
 *
 * Con Hold = ascolta: lascia passare l'ingresso e registra la posizione di ogni
 * evento sulla fase. Con Hold = ripeti: cattura gli ultimi `length` cicli e li
 * rilegge; a ogni giro, ogni evento muta con probabilità `mutation`:
 *
 *   valore / altezza ± `valueStep`   (35%)
 *   spostamento di ± 1/`grid` di ciclo (20%)
 *   caduta                             (15%)
 *   raddoppio su uno step vicino       (15%)
 *   velocity                           (15%)
 *
 * Le mutazioni si riscrivono nel buffer, quindi si accumulano: il loop deriva.
 * `anchor` è la forza di ritorno: a ogni giro, ogni evento originale torna com'era
 * con probabilità `anchor`, e ogni evento nato da una mutazione sparisce con la
 * stessa probabilità.
 *
 * La posizione degli eventi è in cicli di fase, con il loro microtiming: se la
 * fase si piega (swing, Ø Scale), la memoria si piega con lei.
 */

import { mod, phaseAt } from '../../core/phase';
import { cloneJson, type ControlEvent, type ModuleDefinition } from '../../core/types';

/** Cicli di fase tenuti in ascolto: il massimo di `length`. */
const MAX_LENGTH = 16;
const MAX_ITEMS = 256;

interface MemEvent {
  id: number;
  /** id dell'evento originale catturato; null se nato da una mutazione. */
  orig: number | null;
  /** Posizione nel loop, in cicli, in [0, length). */
  pos: number;
  voice: number;
  vel: number;
  kind: 'trig' | 'note';
  value?: number;
  pitch?: number;
  dur?: number;
}

interface Recorded {
  abs: number;
  ev: Omit<MemEvent, 'id' | 'orig' | 'pos'>;
}

interface MemoryState {
  holding: boolean;
  length: number;
  loop: number;
  items: MemEvent[];
  originals: MemEvent[];
  recent: Recorded[];
  nextId: number;
}

const initialState = (): MemoryState => ({
  holding: false,
  length: 1,
  loop: 0,
  items: [],
  originals: [],
  recent: [],
  nextId: 1,
});

function toRecorded(e: ControlEvent): Recorded['ev'] | null {
  if (e.kind === 'trig') return e.value === undefined ? { kind: 'trig', voice: e.voice, vel: e.vel } : { kind: 'trig', voice: e.voice, vel: e.vel, value: e.value };
  if (e.kind === 'note') return { kind: 'note', voice: e.voice, vel: e.vel, pitch: e.pitch, dur: e.dur };
  return null;
}

function toEvent(it: MemEvent, t: number): ControlEvent {
  if (it.kind === 'note') return { kind: 'note', t, voice: it.voice, vel: it.vel, pitch: it.pitch ?? 60, dur: it.dur ?? 0.1 };
  return it.value === undefined
    ? { kind: 'trig', t, voice: it.voice, vel: it.vel }
    : { kind: 'trig', t, voice: it.voice, vel: it.vel, value: it.value };
}

export const memory: ModuleDefinition = {
  manifest: {
    id: 'memory',
    name: 'Memoria',
    category: 'transform',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'in', type: 'control', signal: 'event', poly: true },
    ],
    outputs: [{ id: 'out', type: 'control', signal: 'event', poly: true }],
    params: [
      { id: 'hold', label: 'Hold', min: 0, max: 1, default: 0, kind: 'discrete', options: ['ascolta', 'ripeti'] },
      { id: 'length', label: 'Cicli', min: 1, max: MAX_LENGTH, default: 1, kind: 'discrete' },
      { id: 'mutation', label: 'Mutazione', min: 0, max: 1, default: 0.2, kind: 'continuous' },
      { id: 'anchor', label: 'Ancora', min: 0, max: 1, default: 0.1, kind: 'continuous' },
      { id: 'valueStep', label: 'Passo valore', min: 0, max: 12, default: 1, kind: 'continuous' },
      { id: 'grid', label: 'Griglia', min: 1, max: 64, default: 16, kind: 'discrete' },
    ],
    seeded: true,
  },

  create() {
    let s = initialState();

    return {
      process(ctx, inputs, outputs) {
        const ph = inputs.phase('phase');
        if (!ph) return;
        const a = ph.start[0]!;
        const b = ph.end[0]!;
        const input = inputs.control('in');
        let voices = input?.values.length ?? 1;
        for (const it of s.items) voices = Math.max(voices, it.voice + 1);
        const out = outputs.control('out', voices);
        const hold = ctx.discrete('hold', Math.floor(a)) === 1;

        if (!hold) {
          s.holding = false;
          for (const e of input?.events ?? []) {
            out.events.push({ ...e });
            const ev = toRecorded(e);
            if (ev) s.recent.push({ abs: phaseAt(a, b, ctx.t0, ctx.t1, e.t), ev });
          }
          const keepFrom = b - MAX_LENGTH;
          if (s.recent.length && s.recent[0]!.abs < keepFrom) s.recent = s.recent.filter((r) => r.abs >= keepFrom);
          return;
        }

        if (!s.holding) {
          // cattura: gli ultimi `length` cicli prima di adesso
          const L = ctx.discrete('length', Math.floor(a));
          s.length = L;
          s.items = s.recent
            .filter((r) => r.abs >= a - L && r.abs < a)
            .slice(-MAX_ITEMS)
            .map((r) => ({ ...r.ev, id: s.nextId, orig: s.nextId++, pos: mod(r.abs, L) }))
            .sort((x, y) => x.pos - y.pos);
          s.originals = s.items.map((it) => ({ ...it }));
          s.loop = Math.floor(a / L);
          s.holding = true;
        }

        if (!(b > a)) return; // la memoria si rilegge solo con la fase in avanti
        const L = s.length;
        const timeAt = (x: number): number => ctx.t0 + ((x - a) / (b - a)) * (ctx.t1 - ctx.t0);
        const k1 = Math.floor(b / L);
        for (let k = Math.floor(a / L); k <= k1; k++) {
          while (s.loop < k) {
            s.loop++;
            mutate();
          }
          const segStart = Math.max(a, k * L);
          const segEnd = Math.min(b, (k + 1) * L);
          for (const it of s.items) {
            const abs = k * L + it.pos;
            if (abs >= segStart && abs < segEnd) out.events.push(toEvent(it, timeAt(abs)));
          }
        }
        out.events.sort((x, y) => x.t - y.t);

        function mutate(): void {
          const rng = ctx.rng;
          const anchor = ctx.param('anchor');
          const m = ctx.param('mutation');
          const step = ctx.param('valueStep');
          const grid = ctx.discrete('grid', s.loop);
          // ritorno verso l'originale
          if (anchor > 0) {
            for (const o of s.originals) {
              if (!rng.chance(anchor)) continue;
              const i = s.items.findIndex((it) => it.orig === o.id);
              if (i >= 0) s.items[i] = { ...o };
              else s.items.push({ ...o });
            }
            s.items = s.items.filter((it) => it.orig !== null || !rng.chance(anchor));
          }
          // mutazione, riscritta nel buffer
          const next: MemEvent[] = [];
          for (const it of s.items) {
            if (!rng.chance(m)) {
              next.push(it);
              continue;
            }
            const r = rng.float();
            const dir = rng.chance(0.5) ? 1 : -1;
            const nearPos = mod(it.pos + dir / grid, L);
            if (r < 0.35) {
              if (it.kind === 'note') next.push({ ...it, pitch: (it.pitch ?? 60) + dir * step });
              else if (it.value !== undefined) next.push({ ...it, value: it.value + dir * step });
              else next.push({ ...it, vel: clampVel(it.vel * rng.range(0.6, 1.3)) });
            } else if (r < 0.55) {
              next.push({ ...it, pos: nearPos });
            } else if (r < 0.7) {
              if (s.items.length <= 1) next.push(it); // la memoria non si svuota da sola
            } else if (r < 0.85) {
              next.push(it);
              if (s.items.length < MAX_ITEMS) next.push({ ...it, id: s.nextId++, orig: null, pos: nearPos });
            } else {
              next.push({ ...it, vel: clampVel(it.vel * rng.range(0.6, 1.3)) });
            }
          }
          s.items = next.sort((x, y) => x.pos - y.pos);
        }
      },
      getState: () => cloneJson(s),
      setState(state) {
        s = { ...initialState(), ...cloneJson(state as MemoryState) };
      },
    };
  },
};

function clampVel(v: number): number {
  return Math.max(0.05, Math.min(1, v));
}
