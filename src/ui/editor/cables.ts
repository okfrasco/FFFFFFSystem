/**
 * Cavi in SVG, nello stesso spazio del mondo dei nodi. Curve di Bézier
 * orizzontali; le modulazioni sono tratteggiate e hanno a metà un'etichetta
 * con l'amount, da trascinare in verticale.
 */

import type { PatchConnection } from '../../core/types';

const NS = 'http://www.w3.org/2000/svg';

export interface Point {
  x: number;
  y: number;
}

export interface CableEvents {
  select(c: PatchConnection, alt: boolean): void;
  amount(c: PatchConnection, amount: number): void;
  amountCommit(): void;
}

export const connKey = (c: PatchConnection): string => `${c.from}>${c.to}`;

function bezier(a: Point, b: Point): { d: string; mid: Point } {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  return { d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`, mid };
}

export class CableLayer {
  readonly svg: SVGSVGElement;
  private readonly wires: SVGGElement;
  private readonly temp: SVGPathElement;

  constructor(world: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('cables');
    this.wires = document.createElementNS(NS, 'g');
    this.temp = document.createElementNS(NS, 'path');
    this.temp.classList.add('wire');
    this.svg.append(this.wires, this.temp);
    world.prepend(this.svg);
  }

  render(
    conns: readonly PatchConnection[],
    pos: (endpoint: string) => Point | null,
    color: (c: PatchConnection) => string,
    selected: string | null,
    ev: CableEvents,
  ): void {
    this.wires.innerHTML = '';
    for (const c of conns) {
      const a = pos(c.from);
      const b = pos(c.to);
      if (!a || !b) continue;
      const { d, mid } = bezier(a, b);
      const isMod = c.to.includes('.param:');
      const wire = document.createElementNS(NS, 'path');
      wire.setAttribute('d', d);
      wire.classList.add('wire');
      if (isMod) wire.classList.add('mod');
      if (selected === connKey(c)) wire.classList.add('sel');
      wire.style.stroke = color(c);
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('d', d);
      hit.classList.add('hit');
      hit.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        ev.select(c, e.altKey);
      });
      this.wires.append(wire, hit);
      if (isMod) this.wires.append(this.amountHandle(c, mid, ev));
    }
  }

  private amountHandle(c: PatchConnection, mid: Point, ev: CableEvents): SVGGElement {
    const g = document.createElementNS(NS, 'g');
    g.classList.add('amount');
    const text = document.createElementNS(NS, 'text');
    const amount = c.amount ?? 1;
    text.textContent = (amount >= 0 ? '+' : '') + amount.toFixed(2);
    text.setAttribute('x', String(mid.x - 15));
    text.setAttribute('y', String(mid.y + 3.5));
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(mid.x - 19));
    rect.setAttribute('y', String(mid.y - 7));
    rect.setAttribute('width', '38');
    rect.setAttribute('height', '14');
    g.append(rect, text);
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      g.setPointerCapture(e.pointerId);
      const y0 = e.clientY;
      const move = (m: PointerEvent) => {
        const next = Math.max(-1, Math.min(1, amount + (y0 - m.clientY) / (m.shiftKey ? 400 : 100)));
        ev.amount(c, Math.round(next * 100) / 100);
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        ev.amountCommit();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    g.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      ev.amount(c, amount < 0 ? 0.5 : -amount || -0.5);
      ev.amountCommit();
    });
    return g;
  }

  showTemp(a: Point, b: Point, color: string): void {
    this.temp.setAttribute('d', bezier(a, b).d);
    this.temp.style.stroke = color;
    this.temp.style.display = '';
  }

  hideTemp(): void {
    this.temp.style.display = 'none';
  }
}
