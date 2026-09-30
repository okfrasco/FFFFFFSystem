/**
 * View generica, per i moduli senza view.ts: si costruisce dalle loro porte.
 *   texture → miniatura · audio → oscilloscopio + livello · eventi → rullo
 *   valori → traccia degli ultimi secondi · fase → anello
 * I nodi senza uscite (Uscita, Schermo) mostrano ciò che ricevono.
 */

import type { ModuleDefinition, PortSpec } from '../../core/types';
import { C, clear, frac, label, meter, ring, roll, scope, sparkline, thumbnail, type NodeViewDrawing } from './viewKit';

const kind = (p: PortSpec) => (p.type === 'control' ? (p.signal ?? 'value') : p.type);

export function genericView(def: ModuleDefinition): NodeViewDrawing | null {
  const outs = def.manifest.outputs;
  const ins = def.manifest.inputs;
  const tex = outs.find((p) => p.type === 'texture');
  const aud = outs.find((p) => p.type === 'audio');
  const ev = outs.find((p) => p.type === 'control' && kind(p) === 'event');
  const val = outs.find((p) => p.type === 'control' && kind(p) !== 'event');
  const ph = outs.find((p) => p.type === 'phase');

  if (tex) return { height: 90, draw: (g, w, h, v) => thumbnail(g, v.thumbnail(tex.id), 0, 0, w, h) };
  if (outs.length === 0 && ins.some((p) => p.type === 'texture'))
    return { height: 90, draw: (g, w, h, v) => thumbnail(g, v.input.thumbnail(ins.find((p) => p.type === 'texture')!.id), 0, 0, w, h) };

  if (aud || (outs.length === 0 && ins.some((p) => p.type === 'audio'))) {
    return {
      height: 44,
      draw(g, w, h, v) {
        clear(g, w, h);
        const frame = aud ? v.scope(aud.id) : v.input.scope(ins.find((p) => p.type === 'audio')!.id);
        scope(g, frame, 0, 2, w - 10, h - 4);
        meter(g, (frame?.rms ?? 0) * 2.5, w - 6, 2, 4, h - 4, C.audio);
      },
    };
  }

  if (!ev && !val && !ph) return null;
  return {
    height: 44,
    draw(g, w, h, v) {
      clear(g, w, h);
      const lanes = [ev, val].filter(Boolean).length || 1;
      const laneH = h / lanes;
      let y = 0;
      if (ev) {
        const events = v.events(ev.id, 4);
        const values = events.map((e) => e.v);
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        roll(g, events, v.now, 4, 0, y + 2, w, laneH - 4, C.event, hi > lo ? [lo, hi] : undefined);
        y += laneH;
      }
      if (val) {
        sparkline(g, v.history(val.id, 4, 80), 2, y + 3, w - 4, laneH - 6, kind(val) === 'gate' ? C.gate : C.value);
        y += laneH;
      }
      if (ph && !ev && !val) {
        const x = v.value(ph.id);
        ring(g, h / 2, h / 2, h / 2 - 5, frac(x), C.phase, 3);
        label(g, `ciclo ${Math.floor(x) + 1}`, h + 4, h / 2 - 5, C.text);
      }
    },
  };
}
