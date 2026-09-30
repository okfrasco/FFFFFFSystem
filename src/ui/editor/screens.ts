/**
 * Finestre dei visual: una per ogni nodo Schermo della patch, create e tolte
 * insieme ai nodi. Ognuna si sposta (dalla barra), si ridimensiona
 * (dall'angolo), va a schermo intero, e con ⧉ si stacca in una finestra vera
 * del browser (per un secondo monitor o il proiettore); chiudendola torna qui.
 * Posizione e misura si ricordano tra una sessione e l'altra.
 */

import type { Engine } from '../../core/engine';
import type { VisualRenderer } from '../../visual/renderer';

const STORAGE_KEY = 'ffffff.screens.v1';

interface Geometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Panel {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  popup: Window | null;
}

function loadGeometry(): Record<string, Geometry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Geometry>;
  } catch {
    return {};
  }
}

export function mountScreens(container: HTMLElement, engine: Engine, renderer: VisualRenderer) {
  const panels = new Map<string, Panel>();
  const geometry = loadGeometry();
  let visible = true;

  const saveGeometry = () => {
    for (const [id, p] of panels) {
      const r = p.el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      geometry[id] = { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height };
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(geometry));
    } catch {
      // posizione non salvata: pazienza
    }
  };

  const create = (id: string, index: number): Panel => {
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `<div class="vbar"><span></span>
      <button data-v="pop" title="Apri in una finestra separata (secondo monitor, proiettore)">⧉</button>
      <button data-v="full" title="Schermo intero">⤢</button>
      <button data-v="close" title="Nascondi tutti (V)">✕</button></div><canvas></canvas>
      <div class="popped">in una finestra separata</div>`;
    (el.querySelector('.vbar span') as HTMLElement).textContent = id;
    const g = geometry[id];
    const cw = container.clientWidth;
    Object.assign(el.style, {
      left: `${g?.left ?? Math.max(12, cw - 500 - index * 28)}px`,
      top: `${g?.top ?? 12 + index * 28}px`,
      width: `${g?.width ?? 480}px`,
      height: `${g?.height ?? 300}px`,
    });
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    const panel: Panel = { el, canvas, popup: null };

    for (const ev of ['pointerdown', 'wheel', 'dblclick'] as const) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('pointerup', saveGeometry);
    el.querySelector('[data-v=close]')!.addEventListener('click', () => setVisible(false));
    el.querySelector('[data-v=full]')!.addEventListener('click', () => void canvas.requestFullscreen?.());
    el.querySelector('[data-v=pop]')!.addEventListener('click', () => popOut(id, panel));

    const bar = el.querySelector('.vbar') as HTMLElement;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      bar.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const off = { x: e.clientX - r.left, y: e.clientY - r.top };
      const move = (m: PointerEvent) => {
        el.style.left = `${m.clientX - c.left - off.x}px`;
        el.style.top = `${m.clientY - c.top - off.y}px`;
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        saveGeometry();
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    container.append(el);
    renderer.attachScreen(id, canvas);
    return panel;
  };

  /** Stacca lo schermo in una finestra del browser; chiudendola torna nel pannello. */
  const popOut = (id: string, panel: Panel) => {
    if (panel.popup && !panel.popup.closed) {
      panel.popup.focus();
      return;
    }
    const win = window.open('', `ffffff-${id}`, 'width=960,height=540');
    if (!win) return;
    win.document.title = `FFFFFF · ${id}`;
    win.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;cursor:none';
    win.document.body.innerHTML = '';
    const c = win.document.createElement('canvas');
    c.style.cssText = 'width:100vw;height:100vh;display:block';
    c.title = 'doppio clic: schermo intero';
    c.addEventListener('dblclick', () => void c.requestFullscreen?.());
    win.document.body.append(c);
    panel.popup = win;
    panel.el.classList.add('is-popped');
    renderer.attachScreen(id, c);
    const back = () => {
      panel.popup = null;
      panel.el.classList.remove('is-popped');
      renderer.attachScreen(id, panel.canvas);
    };
    win.addEventListener('pagehide', back);
    // alcuni browser non mandano pagehide quando la finestra si chiude dal sistema
    const watch = window.setInterval(() => {
      if (win.closed) {
        window.clearInterval(watch);
        if (panel.popup === win) back();
      }
    }, 500);
  };

  const setVisible = (show: boolean) => {
    visible = show;
    for (const p of panels.values()) p.el.classList.toggle('hidden', !show);
  };

  /** Una finestra per ogni nodo Schermo della patch. */
  const sync = () => {
    const ids = engine.patch.nodes.filter((n) => n.module === 'screen').map((n) => n.id);
    for (const [id, p] of panels) {
      if (ids.includes(id)) continue;
      p.popup?.close();
      p.el.remove();
      renderer.attachScreen(id, null);
      panels.delete(id);
    }
    ids.forEach((id, i) => {
      if (panels.has(id)) return;
      const p = create(id, i);
      p.el.classList.toggle('hidden', !visible);
      panels.set(id, p);
    });
  };

  engine.changes.add((c) => {
    if (c.kind === 'patch') sync();
  });
  window.addEventListener('beforeunload', () => {
    for (const p of panels.values()) p.popup?.close();
  });
  sync();

  return {
    toggle: () => setVisible(!visible),
    setVisible,
    get count() {
      return panels.size;
    },
  };
}
