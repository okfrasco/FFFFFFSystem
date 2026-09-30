/**
 * Wavetable: i fotogrammi uno dietro l'altro in prospettiva (i lontani più
 * scuri), quello letto adesso in evidenza, e l'oscilloscopio.
 */

import { C, clear, label, scope, type ViewFactory } from '../../../ui/editor/viewKit';
import { BUILTIN } from './tables';
import { currentTable, type WavetableConfig } from './index';

const view: ViewFactory = () => ({
  height: 70,
  draw(g, w, h, v) {
    clear(g, w, h);
    const idx = Math.round(v.param('table'));
    const table = currentTable(idx, v.config<WavetableConfig>() ?? {});
    if (table) {
      const rows = table.levels[4]!;
      const frames = rows.length;
      const cur = Math.round(v.param('position') * (frames - 1));
      const stepX = (w * 0.25) / frames;
      const stepY = (h * 0.45) / frames;
      const fw = w * 0.72;
      const amp = h * 0.2;
      for (let f = frames - 1; f >= 0; f -= f === cur ? 1 : Math.max(1, Math.round(frames / 16))) {
        const ox = 4 + f * stepX;
        const oy = h * 0.75 - f * stepY;
        g.strokeStyle = f === cur ? C.white : `rgba(255,120,140,${0.15 + 0.35 * (1 - f / frames)})`;
        g.lineWidth = f === cur ? 1.5 : 1;
        g.beginPath();
        const fr = rows[f]!;
        for (let i = 0; i <= 64; i++) {
          const y = oy - fr[Math.floor((i / 64) * (fr.length - 1))]! * amp;
          if (i === 0) g.moveTo(ox + (i / 64) * fw, y);
          else g.lineTo(ox + (i / 64) * fw, y);
        }
        g.stroke();
      }
    } else label(g, 'campione mancante: caricalo nel nodo', 3, h / 2, C.event);
    scope(g, v.scope('out'), w * 0.7, h - 22, w * 0.3, 20, C.audio, 1 / Math.max(0.05, v.param('level')));
    label(g, idx < BUILTIN.length ? (BUILTIN[idx]!.name.split(' ')[0] ?? '') : (table?.name ?? 'campione'), 3, 1);
  },
});

export default view;
