/**
 * Tuning nel nodo: "carica .scl" legge un file Scala (e sceglie "file"), sotto
 * i gradi dell'accordatura contro i 12 semitoni temperati (tacche grigie).
 */

import { PRESETS, parseScala, type Tuning } from './scala';
import type { TuningConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { canvasPanel, configOf } from '../../../ui/editor/widgetKit';

export default function tuningWidget(api: EditorApi, nodeId: string): Widget {
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.scl,text/plain';
  file.style.display = 'none';
  const p = canvasPanel('<span class="tname"></span><button data-a="load">carica .scl</button>', 30, (a) => {
    if (a === 'load') file.click();
  });
  const name = p.title.querySelector('.tname') as HTMLElement;
  let error = '';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const t = parseScala(await f.text());
      error = '';
      api.setConfig(nodeId, { ...configOf<TuningConfig>(api, nodeId), file: t } satisfies TuningConfig);
      api.setParam(nodeId, 'preset', PRESETS.length);
      api.commit();
    } catch (e) {
      error = (e as Error).message;
    }
  });
  p.el.append(file);
  const current = (): Tuning => {
    const i = api.engine.graph.has(nodeId) ? Math.round(api.engine.graph.node(nodeId).params.value('preset')) : 1;
    return i >= PRESETS.length ? (configOf<TuningConfig>(api, nodeId).file ?? PRESETS[0]!) : PRESETS[i]!;
  };
  return {
    el: p.el,
    handles: () => false,
    update() {
      const t = current();
      const label = error ? `errore: ${error}` : `${t.name} · ${t.cents.length} note · periodo ${Math.round(t.cents.at(-1) ?? 1200)}¢`;
      if (name.textContent !== label) name.textContent = label;
      const d = p.begin();
      if (!d) return;
      const { g, w, h } = d;
      const period = t.cents.at(-1) ?? 1200;
      const X = (c: number) => 2 + (c / Math.max(period, 1200)) * (w - 4);
      g.fillStyle = '#444';
      for (let s = 0; s <= 12; s++) g.fillRect(X(s * 100), h / 2, 1, h / 2 - 2);
      g.fillStyle = '#5ad1ff';
      for (const c of [0, ...t.cents]) g.fillRect(X(c) - 1, 2, 2, h / 2);
    },
  };
}
