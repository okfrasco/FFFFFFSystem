/**
 * Barra delle scene e del morph.
 *
 * Scene: "+ Scena" salva lo stato attuale (parametri, seed, config e stato
 * interno). Clic = richiama; Shift+clic = richiama anche memorie e stato;
 * ⌘+clic = sovrascrivi con lo stato attuale; Alt+clic = elimina;
 * doppio clic = rinomina.
 *
 * Morph: A e B dai menu (A può essere "attuale"), slider per il crossfade a
 * mano, "▶ Morph" per andare a B in N battute con la curva scelta. Quando lo
 * slider arriva a 0 o a 1 (o il morph a tempo finisce) la patch diventa A o B.
 */

import type { Engine } from '../../core/engine';
import { MORPH_CURVES, Morph, type MorphCurve } from '../../core/morph';
import { captureScene, recallScene } from '../../core/scene';
import type { Patch, Scene } from '../../core/types';

export interface ScenesDeps {
  engine: Engine;
  isRunning(): boolean;
  now(): number;
  /** Applica una patch nuova come modifica (storia + salvataggio); false se non valida. */
  apply(patch: Patch): boolean;
  commit(): void;
  status(msg: string, err?: boolean): void;
}

const CURRENT = '__attuale__';

export function mountScenes(root: HTMLElement, deps: ScenesDeps): { refresh(): void } {
  const { engine } = deps;
  root.className = 'scenebar';
  root.innerHTML = `
    <span class="lab">SCENE</span><span class="list"></span><button data-s="add" title="Salva lo stato attuale come scena">+ Scena</button>
    <span class="sep"></span>
    <span class="lab">MORPH</span>
    <select data-s="a" title="Scena di partenza"></select>
    <input type="range" min="0" max="1" step="0.001" value="0" data-s="slider" title="Crossfade a mano">
    <select data-s="b" title="Scena di arrivo"></select>
    <label>battute <input type="number" min="0.25" max="256" step="0.25" value="8" data-s="bars"></label>
    <select data-s="curve" title="Curva">${MORPH_CURVES.map((c) => `<option>${c}</option>`).join('')}</select>
    <button data-s="play">▶ Morph</button>
    <span class="prog"></span>`;
  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const list = $<HTMLElement>('.list');
  const selA = $<HTMLSelectElement>('[data-s=a]');
  const selB = $<HTMLSelectElement>('[data-s=b]');
  const slider = $<HTMLInputElement>('[data-s=slider]');
  const barsIn = $<HTMLInputElement>('[data-s=bars]');
  const curveSel = $<HTMLSelectElement>('[data-s=curve]');
  const prog = $<HTMLElement>('.prog');
  curveSel.value = 'smooth';
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => e.stopPropagation());

  const scenes = (): Scene[] => engine.patch.scenes ?? [];
  const setScenes = (next: Scene[]) => deps.apply({ ...engine.patch, scenes: next });
  let morphKey = '';

  const refresh = () => {
    list.innerHTML = '';
    scenes().forEach((sc, i) => {
      const b = document.createElement('button');
      b.className = 'scene';
      b.textContent = sc.name;
      b.title = 'clic: richiama · ⇧: con stato · ⌘: sovrascrivi · ⌥: elimina · doppio clic: rinomina';
      b.addEventListener('click', (e) => {
        if (e.altKey) {
          setScenes(scenes().filter((_, k) => k !== i));
          deps.status(`scena ${sc.name} eliminata`);
        } else if (e.metaKey || e.ctrlKey) {
          setScenes(scenes().map((x, k) => (k === i ? captureScene(engine, sc.name, true) : x)));
          deps.status(`scena ${sc.name} sovrascritta`);
        } else {
          morphKey = '';
          slider.value = '0';
          recallScene(engine, sc, e.shiftKey);
          deps.commit();
          deps.status(`scena ${sc.name}${e.shiftKey ? ' (con stato)' : ''}`);
        }
      });
      b.addEventListener('dblclick', () => {
        const name = prompt('Nome della scena', sc.name)?.trim();
        if (name) setScenes(scenes().map((x, k) => (k === i ? { ...x, name } : x)));
      });
      list.append(b);
    });
    const opts = (withCurrent: boolean, sel: HTMLSelectElement, fallback: number) => {
      const prev = sel.value;
      sel.innerHTML = (withCurrent ? `<option value="${CURRENT}">attuale</option>` : '') + scenes().map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
      if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
      else if (sel.options[fallback]) sel.selectedIndex = fallback;
    };
    opts(true, selA, 0);
    opts(false, selB, Math.max(0, scenes().length - 1));
  };

  const sceneFor = (sel: HTMLSelectElement): Scene | null =>
    sel.value === CURRENT ? captureScene(engine, 'attuale') : (scenes()[Number(sel.value)] ?? null);

  /** Il morph per la coppia scelta (lo crea se la coppia è cambiata). */
  const ensureMorph = (): Morph | null => {
    const key = `${selA.value}>${selB.value}`;
    if (engine.morph && key === morphKey) return engine.morph;
    const a = sceneFor(selA);
    const b = sceneFor(selB);
    if (!a || !b) {
      deps.status('servono due scene: salvane una con + Scena', true);
      return null;
    }
    const m = new Morph(engine, a, b);
    m.onFinish = (side) => {
      slider.value = side === 'b' ? '1' : '0';
      morphKey = '';
      deps.commit();
      deps.status(`morph finito: ${side === 'b' ? b.name : a.name}`);
    };
    engine.startMorph(m);
    morphKey = key;
    return m;
  };

  root.addEventListener('click', (e) => {
    const s = (e.target as HTMLElement).dataset.s;
    if (s === 'add') {
      const name = `S${scenes().length + 1}`;
      if (setScenes([...scenes(), captureScene(engine, name, true)])) deps.status(`scena ${name} salvata`);
    } else if (s === 'play') {
      if (!deps.isRunning()) {
        deps.status('il morph a tempo segue il Transport: premi Play', true);
        return;
      }
      const m = ensureMorph();
      if (!m) return;
      m.curve = curveSel.value as MorphCurve;
      m.play(engine.currentBar(deps.now()), Math.max(0.25, Number(barsIn.value) || 8), 1);
      deps.status(`morph verso ${selB.selectedOptions[0]?.text ?? 'B'} in ${barsIn.value} battute`);
    }
  });
  slider.addEventListener('input', () => {
    const m = ensureMorph();
    if (!m) return;
    m.curve = curveSel.value as MorphCurve;
    m.set(Number(slider.value));
  });
  slider.addEventListener('change', () => {
    const v = Number(slider.value);
    if (engine.morph && (v === 0 || v === 1)) engine.morph.finish(v === 1 ? 'b' : 'a');
  });
  for (const sel of [selA, selB]) sel.addEventListener('change', () => (morphKey = ''));

  // lo slider segue il morph a tempo
  const follow = () => {
    const m = engine.morph;
    if (m?.running) slider.value = String(m.progress);
    prog.textContent = m ? `${Math.round(m.progress * 100)}%` : '';
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);

  refresh();
  return { refresh };
}
