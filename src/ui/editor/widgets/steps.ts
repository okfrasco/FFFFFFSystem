/**
 * Tabella di Steps come barre da disegnare. Due scale: "gradi" (interi da −7
 * a 14, per Quantize in modo grado) e "0–1". Trascina sulle barre per
 * disegnare, −/+ cambiano la lunghezza.
 */

import type { StepsConfig } from '../../../modules/generators/steps';
import type { EditorApi, Widget } from '../api';
import { configOf } from './index';

type Display = 'degree' | 'unit';
interface StepsUiConfig extends StepsConfig {
  display?: Display;
}

const RANGE: Record<Display, [number, number]> = { degree: [-7, 14], unit: [0, 1] };

export function stepsWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.innerHTML = '<span>valori</span><button data-a="-">−</button><button data-a="+">+</button><button data-a="mode"></button>';
  const bars = document.createElement('div');
  bars.className = 'bars';
  el.append(title, bars);

  const cfg = () => configOf<StepsUiConfig>(api, nodeId);
  const displayOf = (c: StepsUiConfig): Display =>
    c.display ?? (c.values.every((v) => Number.isInteger(v)) ? 'degree' : 'unit');
  let shown = '';

  const render = () => {
    const c = cfg();
    const display = displayOf(c);
    const [lo, hi] = RANGE[display];
    (title.querySelector('[data-a=mode]') as HTMLElement).textContent = display === 'degree' ? 'gradi' : '0–1';
    bars.innerHTML = '';
    const zero = (0 - lo) / (hi - lo);
    for (const v of c.values) {
      const b = document.createElement('div');
      b.className = 'b';
      b.title = String(+v.toFixed(3));
      const i = document.createElement('i');
      const y = (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
      i.style.bottom = `${Math.min(y, zero) * 100}%`;
      i.style.height = `${Math.max(1.5, Math.abs(y - zero) * 100)}%`;
      b.append(i);
      bars.append(b);
    }
    shown = JSON.stringify(c);
  };

  const write = (values: number[], display?: Display) => {
    const c = cfg();
    const next: StepsUiConfig = { ...c, values };
    if (display) next.display = display;
    api.setConfig(nodeId, next);
  };

  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    const c = cfg();
    if (a === '-' && c.values.length > 1) write(c.values.slice(0, -1));
    else if (a === '+' && c.values.length < 64) write([...c.values, c.values.at(-1) ?? 0]);
    else if (a === 'mode') {
      const d = displayOf(c) === 'degree' ? 'unit' : 'degree';
      write(d === 'unit' ? c.values.map((v) => Math.max(0, Math.min(1, v / 7))) : c.values.map((v) => Math.round(v * 7)), d);
    } else return;
    api.commit();
  });

  bars.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    bars.setPointerCapture(e.pointerId);
    const c = cfg();
    const values = [...c.values];
    const display = displayOf(c);
    const [lo, hi] = RANGE[display];
    let last = -1;
    const set = (ev: PointerEvent) => {
      const r = bars.getBoundingClientRect();
      const idx = Math.max(0, Math.min(values.length - 1, Math.floor(((ev.clientX - r.left) / r.width) * values.length)));
      let v = lo + (1 - (ev.clientY - r.top) / r.height) * (hi - lo);
      v = Math.max(lo, Math.min(hi, v));
      v = display === 'degree' ? Math.round(v) : +v.toFixed(3);
      const from = last < 0 ? idx : last;
      for (let k = Math.min(from, idx); k <= Math.max(from, idx); k++) values[k] = v;
      last = idx;
      write([...values]);
    };
    set(e);
    const up = () => {
      bars.removeEventListener('pointermove', set);
      bars.removeEventListener('pointerup', up);
      api.commit();
    };
    bars.addEventListener('pointermove', set);
    bars.addEventListener('pointerup', up);
  });

  render();
  return {
    el,
    handles: () => false,
    update() {
      if (JSON.stringify(cfg()) !== shown) render();
    },
  };
}
