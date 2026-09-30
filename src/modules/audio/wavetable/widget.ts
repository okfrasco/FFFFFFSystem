/**
 * Wavetable: carica un file come tavola (fotogrammi consecutivi da 2048
 * campioni, come le tavole di Serum; sceglie da solo la tavola "campione").
 * Sotto la forma d'onda si vedono i confini dei fotogrammi e quello letto.
 */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { sampleWidget } from '../../../ui/editor/sampleWidget';
import { configOf } from '../../../ui/editor/widgetKit';
import { getSample } from '../../../core/samples';
import { BUILTIN, TABLE_SIZE } from './tables';
import type { WavetableConfig } from './index';

export default function wavetableWidget(api: EditorApi, nodeId: string): Widget {
  const param = (id: string) => (api.engine.graph.has(nodeId) ? api.engine.graph.node(nodeId).params.value(id) : 0);
  return sampleWidget(api, nodeId, {
    height: 32,
    onLoad: () => api.setParam(nodeId, 'table', BUILTIN.length),
    overlay(g, w, h) {
      const cfg = configOf<WavetableConfig>(api, nodeId);
      const s = getSample(cfg.sample);
      if (!s || Math.round(param('table')) < BUILTIN.length) return;
      const frames = Math.max(1, Math.floor(s.channels[0]!.length / (cfg.frameSize ?? TABLE_SIZE)));
      const fw = ((cfg.frameSize ?? TABLE_SIZE) * frames) / s.channels[0]!.length;
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let f = 1; f < frames && frames <= 128; f++) g.fillRect((f / frames) * fw * w, 0, 1, h);
      const cur = Math.round(param('position') * (frames - 1));
      g.fillStyle = 'rgba(90,209,255,0.35)';
      g.fillRect((cur / frames) * fw * w, 0, (fw * w) / frames, h);
    },
  });
}
