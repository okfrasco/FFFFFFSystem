/**
 * Vista di un nodo: intestazione, porte (ingressi a sinistra, uscite a
 * destra, colorate per tipo di segnale), righe dei parametri con un punto a
 * sinistra che accetta cavi di modulazione, ed eventuale widget dedicato.
 */

import type { PatchNode, PortSpec } from '../../core/types';
import type { EditorApi, Widget } from './api';
import { ParamBar } from './controls';
import { PORT_COLORS } from './style';
import { widgetFor } from './widgets';

export interface NodeView {
  el: HTMLElement;
  head: HTMLElement;
  close: HTMLElement;
  update(now: number): void;
}

export const portColor = (p: PortSpec): string =>
  PORT_COLORS[p.type === 'control' ? (p.signal ?? 'value') : p.type] ?? '#aaa';

export function createNodeView(api: EditorApi, pn: PatchNode): NodeView {
  const gnode = api.engine.graph.node(pn.id);
  const m = gnode.def.manifest;
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.node = pn.id;
  el.style.left = `${pn.ui?.x ?? 0}px`;
  el.style.top = `${pn.ui?.y ?? 0}px`;

  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = `<span class="id"></span><span class="mod"></span><span class="seed"></span><span class="x" title="Elimina">✕</span>`;
  (head.children[0] as HTMLElement).textContent = pn.id;
  (head.children[1] as HTMLElement).textContent = m.name;
  const seedEl = head.children[2] as HTMLElement;
  if (m.seeded) {
    seedEl.textContent = `⚄ ${gnode.seed % 10000}`;
    seedEl.title = `seed ${gnode.seed} · clic: seed nuovo (le scene lo ricordano, il morph lo mescola)`;
    seedEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    seedEl.addEventListener('click', () => api.newSeed(pn.id));
  }
  el.append(head);

  const ports = document.createElement('div');
  ports.className = 'ports';
  const colIn = document.createElement('div');
  colIn.className = 'col in';
  const colOut = document.createElement('div');
  colOut.className = 'col out';
  ports.append(colIn, colOut);
  const outDots: { spec: PortSpec; port: HTMLElement }[] = [];
  for (const p of m.inputs) {
    const port = portEl(p, 'in');
    port.dataset.target = `${pn.id}.${p.id}`;
    api.registerEndpoint(`${pn.id}.${p.id}`, port.querySelector('.dot') as HTMLElement);
    colIn.append(port);
  }
  for (const p of m.outputs) {
    const port = portEl(p, 'out');
    port.dataset.source = `${pn.id}.${p.id}`;
    api.registerEndpoint(`${pn.id}.${p.id}`, port.querySelector('.dot') as HTMLElement);
    colOut.append(port);
    outDots.push({ spec: p, port });
  }
  if (m.inputs.length || m.outputs.length) el.append(ports);

  const widget: Widget | null = widgetFor(api, pn.id, m.id);
  const rows: { id: string; bar?: ParamBar; select?: HTMLSelectElement; mt: HTMLElement }[] = [];
  const params = document.createElement('div');
  params.className = 'params';
  for (const spec of m.params) {
    if (widget?.handles(spec.id)) continue;
    const row = document.createElement('div');
    row.className = 'prow';
    const mt = document.createElement('div');
    mt.className = 'mt';
    mt.title = 'Trascina qui un cavo di controllo per modulare';
    mt.dataset.target = `${pn.id}.param:${spec.id}`;
    api.registerEndpoint(`${pn.id}.param:${spec.id}`, mt);
    const label = document.createElement('div');
    label.className = 'pl';
    label.textContent = spec.label ?? spec.id;
    label.title = spec.id;
    row.append(mt, label);
    if (spec.options) {
      const sel = document.createElement('select');
      spec.options.forEach((o, i) => sel.add(new Option(o, String(i))));
      sel.addEventListener('pointerdown', (e) => e.stopPropagation());
      sel.addEventListener('change', () => {
        api.setParam(pn.id, spec.id, Number(sel.value));
        api.commit();
      });
      row.append(sel);
      rows.push({ id: spec.id, select: sel, mt });
    } else {
      const bar = new ParamBar(spec, {
        change: (n) => api.setParamNormalized(pn.id, spec.id, n),
        commit: () => api.commit(),
      });
      row.append(bar.el);
      rows.push({ id: spec.id, bar, mt });
    }
    params.append(row);
  }
  if (rows.length) el.append(params);
  if (widget) el.append(widget.el);

  return {
    el,
    head,
    close: head.children[3] as HTMLElement,
    update(now) {
      const node = api.engine.graph.node(pn.id);
      for (const r of rows) {
        const modded = api.isModulated(pn.id, r.id);
        r.mt.classList.toggle('on', modded);
        if (r.bar) r.bar.show(node.params.getBaseNormalized(r.id), node.params.normalized(r.id), modded);
        else if (r.select && document.activeElement !== r.select) r.select.value = String(node.params.getBase(r.id));
      }
      widget?.update(now);
    },
  };
}

function portEl(p: PortSpec, side: 'in' | 'out'): HTMLElement {
  const port = document.createElement('div');
  port.className = 'port';
  port.style.color = portColor(p);
  const kind = p.type === 'control' ? (p.signal ?? 'value') : p.type;
  port.title = `${p.id} · ${kind}${p.poly ? ' · poly' : ''}`;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = p.id;
  if (side === 'in') port.append(dot, label);
  else port.append(label, dot);
  return port;
}
