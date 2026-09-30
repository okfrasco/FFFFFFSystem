/**
 * Campione dentro un nodo: "carica audio" apre un file (decodificato,
 * salvato nel browser e scritto nella config come id), sotto la forma d'onda.
 * `overlay` disegna sopra la forma d'onda ciò che serve al modulo (inizio e
 * fine, fette, zona dei grani…); `onClick` riceve la posizione 0–1 cliccata.
 */

import { getSample, type Sample } from '../../core/samples';
import { importAudioFile } from '../sampleStore';
import type { EditorApi, Widget } from './api';
import { canvasPanel, configOf, onDrag } from './widgetKit';

export interface SampleWidgetOptions {
  field?: string;
  height?: number;
  overlay?: (g: CanvasRenderingContext2D, w: number, h: number, now: number) => void;
  onDrag?: (x: number, first: boolean) => void;
  onRelease?: () => void;
  /** Dopo il caricamento di un file (es. per scegliere la tavola "campione"). */
  onLoad?: () => void;
}

/** Picchi per colonna di un campione (cache per larghezza). */
const peaksCache = new WeakMap<Sample, { w: number; min: Float32Array; max: Float32Array }>();
function peaks(s: Sample, w: number) {
  const c = peaksCache.get(s);
  if (c && c.w === w) return c;
  const ch = s.channels[0]!;
  const min = new Float32Array(w);
  const max = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const a = Math.floor((x / w) * ch.length);
    const b = Math.max(a + 1, Math.floor(((x + 1) / w) * ch.length));
    let lo = 0;
    let hi = 0;
    for (let i = a; i < b; i += Math.max(1, Math.floor((b - a) / 64))) {
      lo = Math.min(lo, ch[i]!);
      hi = Math.max(hi, ch[i]!);
    }
    min[x] = lo;
    max[x] = hi;
  }
  const p = { w, min, max };
  peaksCache.set(s, p);
  return p;
}

export function sampleWidget(api: EditorApi, nodeId: string, o: SampleWidgetOptions = {}): Widget {
  const field = o.field ?? 'sample';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'audio/*,.wav,.aif,.aiff,.mp3,.ogg,.flac';
  file.style.display = 'none';
  const p = canvasPanel('<span class="sname"></span><button data-a="load">carica audio</button>', o.height ?? 48, (a) => {
    if (a === 'load') file.click();
  });
  const name = p.title.querySelector('.sname') as HTMLElement;
  let status = '';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    status = 'carico…';
    try {
      const s = await importAudioFile(f);
      status = '';
      api.setConfig(nodeId, { ...configOf<Record<string, unknown>>(api, nodeId), [field]: s.id });
      o.onLoad?.();
      api.commit();
    } catch (e) {
      status = `errore: ${(e as Error).message}`;
    }
  });
  p.el.append(file);
  if (o.onDrag) {
    onDrag(
      p.canvas,
      (e) => o.onDrag!(p.at(e).x, true),
      (e) => o.onDrag!(p.at(e).x, false),
      () => o.onRelease?.(),
    );
  }
  return {
    el: p.el,
    handles: () => false,
    update(now) {
      const id = configOf<Record<string, unknown>>(api, nodeId)[field] as string | undefined;
      const s = getSample(id);
      const label = status || (s ? `${s.name} · ${(s.channels[0]!.length / s.sampleRate).toFixed(2)} s` : id ? 'campione mancante: ricaricalo' : 'nessun campione');
      if (name.textContent !== label) name.textContent = label;
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      if (s) {
        const pk = peaks(s, Math.round(w));
        g.fillStyle = '#5a2a38';
        for (let x = 0; x < pk.w; x++) g.fillRect(x, h / 2 - pk.max[x]! * (h / 2 - 2), 1, Math.max(1, (pk.max[x]! - pk.min[x]!) * (h / 2 - 2)));
      }
      o.overlay?.(g, w, h, now);
    },
  };
}
