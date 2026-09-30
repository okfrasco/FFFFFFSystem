/**
 * Renderer dei visual: fa girare il grafo dei nodi a rate 'frame' a ogni
 * frame, all'istante che si sta sentendo, e mostra l'ingresso dei nodi
 * Schermo sul canvas.
 */

import blitFrag from './blit.frag?raw';
import type { Engine } from '../core/engine';
import type { Registry } from '../core/registry';
import type { Timeline } from '../core/timeline';
import { FrameGraph } from './frameGraph';
import { Pass } from './gl';

export class VisualRenderer {
  readonly gl: WebGL2RenderingContext | null;
  private frames: FrameGraph | null = null;
  private blit: Pass | null = null;
  private last = -1;
  private raf = 0;
  /** Scala del rendering rispetto ai pixel del canvas (meno = più veloce). */
  scale = 0.75;
  private errorHandler: (message: string) => void = () => {};

  constructor(
    engine: Engine,
    mainRegistry: Registry,
    readonly canvas: HTMLCanvasElement,
    /** Istante mostrato, sul clock audio (già compensato dalla latenza d'uscita). */
    private readonly clock: () => number,
    externalTimeline?: (key: string) => Timeline | undefined,
  ) {
    this.gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!this.gl) return;
    this.blit = new Pass(this.gl, blitFrag);
    this.frames = new FrameGraph(engine, mainRegistry, this.gl, externalTimeline);
    this.frames.onError = (m) => this.errorHandler(m);
  }

  set onError(fn: (message: string) => void) {
    this.errorHandler = fn;
    // rimandato: chi imposta il gestore potrebbe non essere ancora pronto a mostrarlo
    if (!this.gl) queueMicrotask(() => fn('WebGL2 non disponibile: i visual sono spenti'));
  }

  /** Disegna un frame. */
  frame(): void {
    const gl = this.gl;
    const graph = this.frames?.graph;
    if (!gl || !graph) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * this.scale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const now = this.clock();
    const prev = this.last < 0 || now < this.last || now - this.last > 0.25 ? now - 1 / 60 : this.last;
    this.last = now;
    try {
      graph.process(prev, now);
    } catch (e) {
      this.errorHandler(`visual: ${(e as Error).message}`);
      this.frames!.graph = null;
      return;
    }
    const screen = graph.order.find((n) => n.def.manifest.id === 'screen');
    const tex = screen?.inputs.texture('in')?.handle as WebGLTexture | null | undefined;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (tex) this.blit!.draw(null, {}, { uIn: tex }, { width: w, height: h });
    else {
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  start(): void {
    if (this.raf) return;
    const loop = () => {
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
