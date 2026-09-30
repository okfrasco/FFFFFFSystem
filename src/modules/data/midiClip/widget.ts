/**
 * MIDI Clip nel nodo: "carica" apre un file .mid (le note finiscono nella
 * patch), sotto la clip come piano roll con la posizione di lettura.
 */

import type { MidiClipConfig } from './index';
import { parseSmf } from './smf';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf, inputValue } from '../../../ui/editor/widgetKit';

export default function midiClipWidget(api: EditorApi, nodeId: string): Widget {
  const cfg = () => configOf<MidiClipConfig>(api, nodeId);
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.mid,.midi,audio/midi';
  file.style.display = 'none';
  const p = canvasPanel('<span class="clipname"></span><button data-a="load">carica .mid</button>', 64, (a) => {
    if (a === 'load') file.click();
  });
  const name = p.title.querySelector('.clipname') as HTMLElement;
  let error = '';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const clip = parseSmf(new Uint8Array(await f.arrayBuffer()));
      if (clip.notes.length === 0) throw new Error('nessuna nota');
      error = '';
      api.setConfig(nodeId, { name: f.name.replace(/\.midi?$/i, ''), ...clip } satisfies MidiClipConfig);
      api.commit();
    } catch (e) {
      error = (e as Error).message;
    }
  });
  p.el.append(file);

  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const c = cfg();
      const label = error ? `errore: ${error}` : `${c.name} · ${c.length / 4} batt. · ${c.notes.length} note${c.tracks > 1 ? ` · ${c.tracks} tracce` : ''}`;
      if (name.textContent !== label) name.textContent = label;
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      let lo = 127;
      let hi = 0;
      for (const n of c.notes) {
        lo = Math.min(lo, n[2]);
        hi = Math.max(hi, n[2]);
      }
      if (hi < lo) return;
      const rows = hi - lo + 1;
      const rh = Math.min(6, (h - 2) / rows);
      const y0 = (h - rows * rh) / 2;
      for (let b = 0; b < c.length; b += 4) {
        g.fillStyle = '#1f1f26';
        g.fillRect((b / c.length) * w, 0, 1, h);
      }
      const ph = inputValue(api, nodeId, 'phase', now);
      let pos = -1;
      if (ph !== null) {
        const beats = api.engine.graph.has(nodeId) ? api.engine.graph.node(nodeId).params.value('beats') : 4;
        pos = ((((ph * beats) % c.length) + c.length) % c.length) / c.length;
      }
      for (const [s, dur, pitch, vel] of c.notes) {
        const x = (s / c.length) * w;
        const on = pos >= s / c.length && pos < (s + dur) / c.length;
        g.fillStyle = on ? '#fff' : `rgba(90,209,255,${0.4 + vel * 0.6})`;
        g.fillRect(x, y0 + (hi - pitch) * rh, Math.max(1.5, (dur / c.length) * w - 1), Math.max(1, rh - 0.5));
      }
      if (pos >= 0) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(pos * w - 0.5, 0, 1, h);
      }
    },
  };
}
