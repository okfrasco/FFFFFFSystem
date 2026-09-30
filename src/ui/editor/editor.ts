/**
 * Editor a nodi. La patch è la fonte di verità: ogni modifica strutturale
 * produce una patch nuova che l'Engine applica riusando i nodi rimasti
 * (si modifica mentre suona). I parametri si cambiano al volo e a fine gesto
 * entrano nella storia dell'annulla e nel salvataggio automatico.
 *
 * Mouse: trascina da un'uscita a un ingresso (o al punto di un parametro, o a
 * una cella della matrice) per collegare; trascina da un ingresso collegato
 * per staccare il cavo; clic su un cavo per selezionarlo, Alt+clic per
 * toglierlo; trascina lo sfondo per spostarti, pinch o Ctrl+rotella per lo zoom.
 */

import { Engine } from '../../core/engine';
import { GraphError } from '../../core/graph';
import {
  addNode,
  autoLayout,
  connect,
  connectionError,
  disconnect,
  emptyPatch,
  moveNode,
  removeNode,
  setAmount,
} from '../../core/patchEdit';
import type { Registry } from '../../core/registry';
import type { Timeline } from '../../core/timeline';
import type { Patch, PatchConnection, PortSpec } from '../../core/types';
import { cloneJson, frac } from '../../core/types';
import type { Host } from '../host';
import { openAddMenu } from './addMenu';
import type { EditorApi } from './api';
import { CableLayer, connKey, type Point } from './cables';
import { createNodeView, portColor, type NodeView } from './nodeView';
import { EDITOR_CSS } from './style';
import { VisualRenderer } from '../../visual/renderer';
import { mountScenes } from './scenes';

const STORAGE_KEY = 'ffffff.patch.v1';

export interface EditorOptions {
  host: Host;
  registry: Registry;
  example: Patch;
  /** La patch iniziale non aveva posizioni: impila i nodi dopo il primo disegno. */
  relayout?: boolean;
}

interface PortLive {
  dot: HTMLElement;
  port: HTMLElement;
  spec: PortSpec;
  tl: Timeline;
}

export function loadSavedPatch(): Patch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Patch) : null;
  } catch {
    return null;
  }
}

export function mountEditor(root: HTMLElement, opts: EditorOptions): void {
  const { host, registry } = opts;
  const engine: Engine = host.engine;

  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  document.head.append(style);
  root.innerHTML = `
    <div class="app">
      <div class="toolbar">
        <h1>FFFFFF SYSTEM</h1>
        <button class="play" data-a="play" title="Spazio">▶ Play</button>
        <span class="pos">—</span>
        <span class="sep"></span>
        <button data-a="add" title="Tab o doppio clic sullo sfondo">+ Nodo</button>
        <button data-a="undo" title="⌘Z">Annulla</button>
        <button data-a="redo" title="⇧⌘Z">Ripeti</button>
        <span class="sep"></span>
        <button data-a="new">Nuova</button>
        <button data-a="open">Apri…</button>
        <button data-a="save">Salva</button>
        <button data-a="example">Esempio</button>
        <button data-a="fit" title="F">Adatta</button>
        <button data-a="visual" title="V">Visual</button>
        <span class="status"></span>
        <input type="file" accept=".json,application/json" hidden>
      </div>
      <div class="canvas">
        <div class="help">doppio clic / Tab: aggiungi · trascina uscita → ingresso o punto di un parametro<br>
        Alt+clic su un cavo: togli · Canc: elimina selezione · ⌘D: duplica · ⌘Z: annulla · Spazio: play</div>
        <div class="world"></div>
        <div class="viewer"><div class="vbar"><span>visual</span><button data-v="full" title="Schermo intero">⤢</button><button data-v="close" title="Nascondi (V)">✕</button></div><canvas></canvas></div>
      </div>
      <div class="scenes"></div>
    </div>`;
  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const canvas = $<HTMLElement>('.canvas');
  const world = $<HTMLElement>('.world');
  const statusEl = $<HTMLElement>('.status');
  const posEl = $<HTMLElement>('.pos');
  const playBtn = $<HTMLButtonElement>('[data-a=play]');
  const fileInput = $<HTMLInputElement>('input[type=file]');
  const cables = new CableLayer(world);
  host.onError = (msg) => status(msg, true);

  // ─── vista dei visual ─────────────────────────────────────────────────
  const viewer = $<HTMLElement>('.viewer');
  const renderer = new VisualRenderer(
    engine,
    registry,
    viewer.querySelector('canvas') as HTMLCanvasElement,
    () => host.displayTime(),
    (key) => host.analysisTimeline(key),
  );
  renderer.onError = (msg) => status(msg, true);
  const toggleViewer = (show = viewer.classList.contains('hidden')) => {
    viewer.classList.toggle('hidden', !show);
    if (show) renderer.start();
    else renderer.stop();
  };
  viewer.addEventListener('pointerdown', (e) => e.stopPropagation());
  viewer.addEventListener('wheel', (e) => e.stopPropagation());
  viewer.addEventListener('dblclick', (e) => e.stopPropagation());
  viewer.querySelector('[data-v=close]')!.addEventListener('click', () => toggleViewer(false));
  viewer.querySelector('[data-v=full]')!.addEventListener('click', () => void viewer.requestFullscreen?.());
  const vbar = viewer.querySelector('.vbar') as HTMLElement;
  vbar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    vbar.setPointerCapture(e.pointerId);
    const r = viewer.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const off = { x: e.clientX - r.left, y: e.clientY - r.top };
    const move = (m: PointerEvent) => {
      viewer.style.left = `${m.clientX - c.left - off.x}px`;
      viewer.style.top = `${m.clientY - c.top - off.y}px`;
      viewer.style.right = 'auto';
    };
    const up = () => {
      vbar.removeEventListener('pointermove', move);
      vbar.removeEventListener('pointerup', up);
    };
    vbar.addEventListener('pointermove', move);
    vbar.addEventListener('pointerup', up);
  });

  let committed: Patch = engine.patch;
  const history: Patch[] = [];
  const future: Patch[] = [];
  const views = new Map<string, NodeView>();
  const endpoints = new Map<string, HTMLElement>();
  const liveOuts: PortLive[] = [];
  const flashes: { t: number; port: HTMLElement }[] = [];
  const lit: { until: number; port: HTMLElement }[] = [];
  let selNode: string | null = null;
  let selCable: string | null = null;
  const view = { x: 0, y: 0, zoom: 1 };
  let mouse: Point = { x: 200, y: 200 };
  let cablesDirty = true;

  // ─── stato e storia ───────────────────────────────────────────────────
  const status = (msg: string, err = false) => {
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', err);
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.patch));
    } catch {
      // storage pieno o bloccato: il salvataggio automatico è solo una comodità
    }
  };
  const commit = () => {
    if (engine.patch === committed) return;
    history.push(committed);
    if (history.length > 200) history.shift();
    future.length = 0;
    committed = engine.patch;
    save();
  };
  /** Applica una patch nuova; false (con messaggio) se non è valida. */
  const apply = (patch: Patch, rerender = true): boolean => {
    try {
      engine.setPatch(patch);
    } catch (e) {
      status(e instanceof GraphError ? e.errors.join(' · ') : (e as Error).message, true);
      return false;
    }
    commit();
    if (rerender) render();
    else cablesDirty = true;
    return true;
  };
  /**
   * Dopo il primo disegno di una patch senza posizioni: impila ogni colonna
   * con le altezze vere dei nodi (i widget le rendono difficili da stimare).
   */
  const stackColumns = () => {
    for (const v of views.values()) v.update(host.now()); // i widget si costruiscono al primo aggiornamento
    const cols = new Map<number, { id: string; y: number }[]>();
    for (const n of engine.patch.nodes) {
      const x = n.ui?.x ?? 0;
      if (!cols.has(x)) cols.set(x, []);
      cols.get(x)!.push({ id: n.id, y: n.ui?.y ?? 0 });
    }
    let patch = engine.patch;
    for (const [x, col] of cols) {
      col.sort((a, b) => a.y - b.y);
      let y = 40;
      for (const { id } of col) {
        patch = moveNode(patch, id, { x, y });
        y += (views.get(id)?.el.offsetHeight ?? 120) + 24;
      }
    }
    engine.setPatch(patch);
    committed = patch;
    save();
    render();
  };

  const replaceAll = (patch: Patch) => {
    const needsLayout = patch.nodes.some((n) => !n.ui);
    const laid = autoLayout(patch, registry);
    try {
      engine.setPatch(laid);
    } catch (e) {
      status(e instanceof GraphError ? e.errors.join(' · ') : (e as Error).message, true);
      return;
    }
    history.length = 0;
    future.length = 0;
    committed = laid;
    save();
    render();
    if (needsLayout) stackColumns();
    fit();
  };
  const undo = () => {
    const prev = history.pop();
    if (!prev) return;
    engine.setPatch(prev);
    future.push(committed);
    committed = prev;
    save();
    render();
  };
  const redo = () => {
    const next = future.pop();
    if (!next) return;
    engine.setPatch(next);
    history.push(committed);
    committed = next;
    save();
    render();
  };

  const api: EditorApi = {
    engine,
    now: () => host.now(),
    setParamNormalized(nodeId, paramId, n) {
      engine.graph.node(nodeId).params.setBaseNormalized(paramId, n);
      engine.setParam(nodeId, paramId, engine.graph.getParam(nodeId, paramId));
    },
    setParam: (nodeId, paramId, value) => engine.setParam(nodeId, paramId, value),
    setConfig: (nodeId, config) => engine.setConfig(nodeId, config),
    commit,
    isModulated: (nodeId, paramId) => engine.patch.connections.some((c) => c.to === `${nodeId}.param:${paramId}`),
    newSeed(nodeId) {
      // il seed si sceglie nell'interfaccia: qui la casualità non entra nella musica
      const seed = Math.floor(Math.random() * 1e9);
      apply({ ...engine.patch, nodes: engine.patch.nodes.map((n) => (n.id === nodeId ? { ...n, seed } : n)) });
    },
    registerEndpoint: (ep, el) => endpoints.set(ep, el),
  };

  // ─── rendering ────────────────────────────────────────────────────────
  const applyView = () => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    canvas.style.backgroundPosition = `${view.x}px ${view.y}px`;
    canvas.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`;
  };

  const render = () => {
    for (const v of views.values()) v.el.remove();
    views.clear();
    endpoints.clear();
    liveOuts.length = 0;
    for (const pn of engine.patch.nodes) {
      const v = createNodeView(api, pn);
      views.set(pn.id, v);
      v.el.classList.toggle('sel', pn.id === selNode);
      bindNode(v, pn.id);
      world.append(v.el);
      for (const spec of engine.graph.node(pn.id).def.manifest.outputs) {
        const dot = endpoints.get(`${pn.id}.${spec.id}`);
        if (!dot || (spec.type !== 'phase' && spec.type !== 'control')) continue;
        liveOuts.push({ dot, port: dot.parentElement as HTMLElement, spec, tl: engine.tap(pn.id, spec.id, 64) });
      }
    }
    if (selNode && !views.has(selNode)) selNode = null;
    cablesDirty = true;
  };

  const posOf = (ep: string): Point | null => {
    const el = endpoints.get(ep);
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    const w = world.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - w.left) / view.zoom, y: (r.top + r.height / 2 - w.top) / view.zoom };
  };
  const specOfSource = (ep: string): PortSpec | undefined => {
    const [node, port] = ep.split('.') as [string, string];
    return engine.graph.has(node) ? engine.graph.node(node).def.manifest.outputs.find((p) => p.id === port) : undefined;
  };
  const drawCables = () => {
    cables.render(
      engine.patch.connections,
      posOf,
      (c) => {
        const s = specOfSource(c.from);
        return s ? portColor(s) : '#888';
      },
      selCable,
      {
        select(c, alt) {
          if (alt) {
            apply(disconnect(engine.patch, c.from, c.to), false);
            selCable = null;
          } else {
            selCable = connKey(c);
            selectNode(null);
          }
          cablesDirty = true;
        },
        amount(c, amount) {
          try {
            engine.setPatch(setAmount(engine.patch, c.from, c.to, amount));
          } catch (e) {
            status((e as Error).message, true);
          }
          cablesDirty = true;
        },
        amountCommit: commit,
      },
    );
    cablesDirty = false;
  };

  const selectNode = (id: string | null) => {
    selNode = id;
    for (const [k, v] of views) v.el.classList.toggle('sel', k === id);
  };

  // ─── nodi: trascinamento, elimina ─────────────────────────────────────
  const bindNode = (v: NodeView, id: string) => {
    v.close.addEventListener('pointerdown', (e) => e.stopPropagation());
    v.close.addEventListener('click', () => apply(removeNode(engine.patch, id)));
    v.head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectNode(id);
      selCable = null;
      cablesDirty = true;
      v.head.setPointerCapture(e.pointerId);
      const start = { x: parseFloat(v.el.style.left), y: parseFloat(v.el.style.top) };
      const p0 = { x: e.clientX, y: e.clientY };
      let moved = false;
      const move = (m: PointerEvent) => {
        const x = Math.round(start.x + (m.clientX - p0.x) / view.zoom);
        const y = Math.round(start.y + (m.clientY - p0.y) / view.zoom);
        moved = true;
        v.el.style.left = `${x}px`;
        v.el.style.top = `${y}px`;
        cablesDirty = true;
      };
      const up = () => {
        v.head.removeEventListener('pointermove', move);
        v.head.removeEventListener('pointerup', up);
        if (moved) apply(moveNode(engine.patch, id, { x: parseFloat(v.el.style.left), y: parseFloat(v.el.style.top) }), false);
      };
      v.head.addEventListener('pointermove', move);
      v.head.addEventListener('pointerup', up);
    });
  };

  // ─── cavi: trascinamento ──────────────────────────────────────────────
  const toWorld = (clientX: number, clientY: number): Point => {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
  };

  const startCable = (fixed: string, fromSource: boolean, e: PointerEvent) => {
    const color = fromSource ? portColor(specOfSource(fixed) ?? { id: '', type: 'control' }) : '#aaa';
    const anchor = posOf(fixed);
    if (!anchor) return;
    canvas.classList.add('dragging-cable');
    let hover: HTMLElement | null = null;
    const conn = (other: string): PatchConnection => (fromSource ? { from: fixed, to: other } : { from: other, to: fixed });
    const candidate = (x: number, y: number): HTMLElement | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return (el?.closest(fromSource ? '[data-target]' : '[data-source]') as HTMLElement | null) ?? null;
    };
    const move = (m: PointerEvent) => {
      const p = toWorld(m.clientX, m.clientY);
      if (fromSource) cables.showTemp(anchor, p, color);
      else cables.showTemp(p, anchor, color);
      const c = candidate(m.clientX, m.clientY);
      if (c !== hover) {
        hover?.classList.remove('target-ok');
        hover = c;
        const other = c && (fromSource ? c.dataset.target : c.dataset.source);
        if (c && other && !connectionError(engine.patch, registry, conn(other))) c.classList.add('target-ok');
      }
    };
    const up = (m: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.classList.remove('dragging-cable');
      hover?.classList.remove('target-ok');
      cables.hideTemp();
      const c = candidate(m.clientX, m.clientY);
      const other = c && (fromSource ? c.dataset.target : c.dataset.source);
      if (!other) return;
      try {
        const next = connect(engine.patch, registry, conn(other));
        if (apply(next, false)) status(`collegato ${conn(other).from} → ${conn(other).to}`);
      } catch (err) {
        status((err as Error).message, true);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e);
  };

  world.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    const src = t.closest('[data-source]') as HTMLElement | null;
    if (src?.dataset.source) {
      e.stopPropagation();
      startCable(src.dataset.source, true, e);
      return;
    }
    const tgt = t.closest('.port[data-target], .mt[data-target]') as HTMLElement | null;
    const ep = tgt?.dataset.target;
    if (ep) {
      e.stopPropagation();
      const existing = [...engine.patch.connections].reverse().find((c) => c.to === ep);
      if (existing) {
        // stacca il cavo e lo riprende in mano dalla sua sorgente
        if (apply(disconnect(engine.patch, existing.from, existing.to), false)) {
          drawCables();
          startCable(existing.from, true, e);
        }
      } else {
        startCable(ep, false, e);
      }
    }
  });

  // ─── sfondo: pan, zoom, menu ──────────────────────────────────────────
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    selectNode(null);
    selCable = null;
    cablesDirty = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('panning');
    const p0 = { x: e.clientX - view.x, y: e.clientY - view.y };
    const move = (m: PointerEvent) => {
      view.x = m.clientX - p0.x;
      view.y = m.clientY - p0.y;
      applyView();
    };
    const up = () => {
      canvas.classList.remove('panning');
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if ((e.target as HTMLElement).closest('.addmenu, textarea')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = canvas.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const z = Math.max(0.25, Math.min(2.5, view.zoom * Math.exp(-e.deltaY * 0.01)));
        view.x = cx - ((cx - view.x) * z) / view.zoom;
        view.y = cy - ((cy - view.y) * z) / view.zoom;
        view.zoom = z;
      } else {
        view.x -= e.deltaX;
        view.y -= e.deltaY;
      }
      applyView();
    },
    { passive: false },
  );
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  });

  const showAddMenu = (at: Point) => {
    openAddMenu(canvas, at, registry, (moduleId) => {
      const w = { x: (at.x - view.x) / view.zoom, y: (at.y - view.y) / view.zoom };
      const { patch, id } = addNode(engine.patch, registry, moduleId, { x: Math.round(w.x), y: Math.round(w.y) });
      if (apply(patch)) {
        selectNode(id);
        status(`aggiunto ${id}`);
      }
    });
  };
  canvas.addEventListener('dblclick', (e) => {
    if (e.target !== canvas && e.target !== world) return;
    const r = canvas.getBoundingClientRect();
    showAddMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
  });

  const fit = () => {
    const nodes = engine.patch.nodes;
    if (!nodes.length) {
      Object.assign(view, { x: 0, y: 0, zoom: 1 });
      applyView();
      return;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
      const el = views.get(n.id)?.el;
      const x = n.ui?.x ?? 0;
      const y = n.ui?.y ?? 0;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + (el?.offsetWidth ?? 200));
      y1 = Math.max(y1, y + (el?.offsetHeight ?? 120));
    }
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    view.zoom = Math.max(0.25, Math.min(1, Math.min((W - 60) / (x1 - x0), (H - 60) / (y1 - y0))));
    view.x = (W - (x1 - x0) * view.zoom) / 2 - x0 * view.zoom;
    view.y = (H - (y1 - y0) * view.zoom) / 2 - y0 * view.zoom;
    applyView();
    cablesDirty = true;
  };

  // ─── tastiera e toolbar ───────────────────────────────────────────────
  const togglePlay = async () => {
    if (host.running) host.stop();
    else await host.start();
    playBtn.dataset.on = host.running ? '1' : '0';
    playBtn.textContent = host.running ? '■ Stop' : '▶ Play';
  };
  const deleteSelection = () => {
    if (selCable) {
      const c = engine.patch.connections.find((x) => connKey(x) === selCable);
      if (c) apply(disconnect(engine.patch, c.from, c.to), false);
      selCable = null;
    } else if (selNode) {
      apply(removeNode(engine.patch, selNode));
      selNode = null;
    }
  };
  const duplicate = () => {
    const src = engine.patch.nodes.find((n) => n.id === selNode);
    if (!src) return;
    const { patch, id } = addNode(engine.patch, registry, src.module, { x: (src.ui?.x ?? 0) + 30, y: (src.ui?.y ?? 0) + 30 });
    const copy = patch.nodes.map((n) =>
      n.id === id ? { ...n, ...(src.params ? { params: { ...src.params } } : {}), ...(src.config ? { config: cloneJson(src.config) } : {}) } : n,
    );
    if (apply({ ...patch, nodes: copy })) selectNode(id);
  };

  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === ' ') void togglePlay();
    else if (e.key === 'Tab') showAddMenu(mouse);
    else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
    else if (mod && e.key.toLowerCase() === 'z') (e.shiftKey ? redo : undo)();
    else if (mod && e.key.toLowerCase() === 'd') duplicate();
    else if (!mod && (e.key === 'f' || e.key === 'F')) fit();
    else if (!mod && (e.key === 'v' || e.key === 'V')) toggleViewer();
    else return;
    e.preventDefault();
  });

  $<HTMLElement>('.toolbar').addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a === 'play') void togglePlay();
    else if (a === 'add') showAddMenu({ x: canvas.clientWidth / 2 - 120, y: 60 });
    else if (a === 'undo') undo();
    else if (a === 'redo') redo();
    else if (a === 'new') replaceAll(addNode(emptyPatch(Date.now() % 100000), registry, 'transport', { x: 60, y: 60 }).patch);
    else if (a === 'open') fileInput.click();
    else if (a === 'save') {
      const blob = new Blob([JSON.stringify(engine.patch, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'patch.json';
      link.click();
      URL.revokeObjectURL(link.href);
    } else if (a === 'example') replaceAll(opts.example);
    else if (a === 'fit') fit();
    else if (a === 'visual') toggleViewer();
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    try {
      replaceAll(JSON.parse(await f.text()) as Patch);
      status(`aperto ${f.name}`);
    } catch (err) {
      status(`file non valido: ${(err as Error).message}`, true);
    }
  });

  // ─── eventi per l'interfaccia: lampeggio delle uscite ─────────────────
  engine.listeners.add((_t0, _t1, graph) => {
    if (flashes.length > 2000) return;
    for (const lo of liveOuts) {
      if (lo.spec.type !== 'control' || !lo.dot.isConnected) continue;
      const [node, port] = (lo.port.dataset.source ?? '').split('.') as [string, string];
      if (!graph.has(node)) continue;
      const buf = graph.output(node, port);
      if (buf.type === 'control') for (const ev of buf.events) flashes.push({ t: ev.t, port: lo.port });
    }
  });

  // ─── ciclo di disegno ─────────────────────────────────────────────────
  let lastSize = '';
  const frame = () => {
    const now = host.now();
    for (const v of views.values()) v.update(now);
    // lampeggi programmati al loro tempo
    flashes.sort((a, b) => a.t - b.t);
    while (flashes.length && flashes[0]!.t <= now) {
      const f = flashes.shift()!;
      f.port.classList.add('flash');
      lit.push({ until: now + 0.08, port: f.port });
    }
    for (let i = lit.length - 1; i >= 0; i--) {
      if (lit[i]!.until <= now) {
        lit[i]!.port.classList.remove('flash');
        lit.splice(i, 1);
      }
    }
    if (!host.running) flashes.length = 0;
    // fasi: il riempimento del punto segue la rampa; valori: luminosità
    for (const lo of liveOuts) {
      if (lo.tl.size === 0) continue;
      const x = lo.tl.sample(now);
      if (lo.spec.type === 'phase') {
        lo.dot.style.background = `conic-gradient(currentColor ${frac(x) * 360}deg, #0b0b0d 0)`;
      } else if ((lo.spec.signal ?? 'value') === 'value') {
        const v = Math.max(0, Math.min(1, Math.abs(x)));
        lo.dot.style.background = `color-mix(in srgb, currentColor ${Math.round(v * 100)}%, #0b0b0d)`;
      }
    }
    // posizione del primo Transport
    const tr = engine.patch.nodes.find((n) => n.module === 'transport');
    if (tr && host.running) {
      const bars = engine.tap(tr.id, 'bar', 64).sample(now);
      const meter = engine.graph.getParam(tr.id, 'meter');
      posEl.textContent = `${Math.floor(bars) + 1}.${Math.floor(frac(bars) * meter + 1e-9) + 1}`;
    }
    // le altezze dei nodi cambiano (widget): ridisegna i cavi se serve
    const size = [...views.values()].map((v) => `${v.el.offsetWidth}x${v.el.offsetHeight}`).join();
    if (size !== lastSize) {
      lastSize = size;
      cablesDirty = true;
    }
    if (cablesDirty) drawCables();
    requestAnimationFrame(frame);
  };

  const sceneBar = mountScenes($<HTMLElement>('.scenes'), {
    engine,
    isRunning: () => host.running,
    now: () => host.now(),
    apply: (p) => apply(p, false),
    commit,
    status,
  });
  // scene e morph cambiano i seed: i nodi si ridisegnano solo quando serve
  const seedsOf = () => engine.patch.nodes.map((n) => `${n.id}:${n.seed ?? ''}`).join();
  let shownSeeds = seedsOf();
  engine.changes.add((c) => {
    if (c.kind !== 'patch') return;
    sceneBar.refresh();
    const now = seedsOf();
    if (now !== shownSeeds) {
      shownSeeds = now;
      requestAnimationFrame(() => render());
    }
  });

  // la vista parte visibile se la patch ha uno Schermo
  toggleViewer(engine.patch.nodes.some((n) => n.module === 'screen'));
  applyView();
  render();
  requestAnimationFrame(() => {
    if (opts.relayout) stackColumns();
    fit();
    frame();
  });
  status('pronto');
}
