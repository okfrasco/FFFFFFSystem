/**
 * Controllo a barra per un parametro: si trascina in orizzontale nello spazio
 * normalizzato (Shift = fine, doppio clic = default). Mostra il valore base e,
 * se il parametro è modulato, un segno sul valore effettivo.
 */

import { denormalize, normalize } from '../../core/params';
import type { ParamSpec } from '../../core/types';

export interface BarHandlers {
  /** Durante il trascinamento: nuovo valore normalizzato. */
  change(n: number): void;
  /** Fine del gesto (per l'annulla). */
  commit(): void;
}

export function formatParam(spec: ParamSpec, v: number): string {
  if (spec.options) return spec.options[v] ?? String(v);
  if (spec.kind === 'discrete') return String(v);
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(1) : a >= 10 ? v.toFixed(2) : v.toFixed(3);
  return spec.unit ? `${s} ${spec.unit}` : s;
}

export class ParamBar {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLElement;
  private readonly mark: HTMLElement;
  private readonly text: HTMLElement;

  constructor(
    private readonly spec: ParamSpec,
    handlers: BarHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bar';
    this.el.innerHTML = '<div class="fill"></div><div class="modmark"></div><span class="val"></span>';
    this.fill = this.el.children[0] as HTMLElement;
    this.mark = this.el.children[1] as HTMLElement;
    this.text = this.el.children[2] as HTMLElement;

    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.el.setPointerCapture(e.pointerId);
      const rect = this.el.getBoundingClientRect();
      let n = this.current;
      let lastX = e.clientX;
      if (!e.shiftKey) {
        n = (e.clientX - rect.left) / rect.width;
        handlers.change(clamp(n));
      }
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        n = clamp(n + (dx / rect.width) * (ev.shiftKey ? 0.1 : 1));
        handlers.change(n);
      };
      const up = () => {
        this.el.removeEventListener('pointermove', move);
        this.el.removeEventListener('pointerup', up);
        handlers.commit();
      };
      this.el.addEventListener('pointermove', move);
      this.el.addEventListener('pointerup', up);
    });
    this.el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      handlers.change(normalize(spec, spec.default));
      handlers.commit();
    });
  }

  private current = 0;

  /** base e effettivo normalizzati; `modded` mostra il segno della modulazione. */
  show(base: number, effective: number, modded: boolean): void {
    this.current = base;
    this.fill.style.width = `${base * 100}%`;
    this.el.classList.toggle('modded', modded);
    if (modded) this.mark.style.left = `calc(${effective * 100}% - 1px)`;
    this.text.textContent = formatParam(this.spec, denormalize(this.spec, modded ? effective : base));
  }
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
