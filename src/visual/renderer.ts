/**
 * Renderer dei visual: fa girare il grafo dei nodi a rate 'frame' a ogni
 * frame, all'istante che si sta sentendo. Disegna in un canvas WebGL fuori
 * dalla pagina e copia l'immagine di ogni nodo Schermo nel canvas che gli è
 * stato assegnato (un pannello dell'editor o una finestra separata): un solo
 * contesto WebGL, quindi ogni visual si può collegare a qualunque schermo.
 */

import blitFrag from './blit.frag?raw';
import type { Engine } from '../core/engine';
import type { Registry } from '../core/registry';
import type { Timeline } from '../core/timeline';
import { FrameGraph } from './frameGraph';
import { Pass, createTarget, type Target } from './gl';

export class VisualRenderer {
  readonly gl: WebGL2RenderingContext | null;
  /** Canvas WebGL di lavoro (non sta nella pagina). */
  readonly canvas: HTMLCanvasElement;
  private frames: FrameGraph | null = null;
  private blit: Pass | null = null;
  private last = -1;
  private raf = 0;
  /** Canvas di destinazione di ogni nodo Schermo (id → canvas 2D). */
  private readonly screens = new Map<string, HTMLCanvasElement>();
  /** Miniature delle uscite texture ("nodo.porta"), per le view dei nodi. */
  readonly thumbnails = new Map<string, ImageData>();
  static readonly THUMB = { width: 160, height: 90 };
  private thumbTarget: Target | null = null;
  private thumbPixels = new Uint8Array(0);
  private frameCount = 0;
  /** Scala del rendering rispetto ai pixel degli schermi (meno = più veloce). */
  scale = 0.75;
  private errorHandler: (message: string) => void = () => {};

  constructor(
    engine: Engine,
    frameRegistry: () => Registry,
    /** Istante mostrato, sul clock audio (già compensato dalla latenza d'uscita). */
    private readonly clock: () => number,
    externalTimeline?: (key: string) => Timeline | undefined,
  ) {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!this.gl) return;
    this.blit = new Pass(this.gl, blitFrag);
    this.frames = new FrameGraph(engine, frameRegistry, this.gl, externalTimeline);
    this.frames.onError = (m) => this.errorHandler(m);
  }

  set onError(fn: (message: string) => void) {
    this.errorHandler = fn;
    // rimandato: chi imposta il gestore potrebbe non essere ancora pronto a mostrarlo
    if (!this.gl) queueMicrotask(() => fn('WebGL2 non disponibile: i visual sono spenti'));
  }

  /** Dove mostrare lo Schermo `nodeId` (null = da nessuna parte). */
  attachScreen(nodeId: string, canvas: HTMLCanvasElement | null): void {
    if (canvas) this.screens.set(nodeId, canvas);
    else this.screens.delete(nodeId);
  }

  /** Disegna un frame. */
  frame(): void {
    const gl = this.gl;
    const graph = this.frames?.graph;
    if (!gl || !graph) return;
    // i visual si calcolano alla misura dello schermo più grande (almeno 480×270)
    const dprOf = (c: HTMLCanvasElement) => Math.min(2, c.ownerDocument.defaultView?.devicePixelRatio || 1);
    let w = Math.round(480 * this.scale);
    let h = Math.round(270 * this.scale);
    const sizes = new Map<string, { w: number; h: number }>();
    for (const [id, c] of this.screens) {
      if (!c.isConnected || !c.clientWidth || !c.clientHeight) continue;
      const sw = Math.max(1, Math.round(c.clientWidth * dprOf(c) * this.scale));
      const sh = Math.max(1, Math.round(c.clientHeight * dprOf(c) * this.scale));
      sizes.set(id, { w: sw, h: sh });
      w = Math.max(w, sw);
      h = Math.max(h, sh);
    }
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
    if (++this.frameCount % 2 === 0) this.captureThumbnails(gl, graph);
    // ogni Schermo: la sua texture in un angolo del canvas di lavoro, poi copiata nel suo canvas
    for (const node of graph.order) {
      if (node.def.manifest.id !== 'screen') continue;
      const target = this.screens.get(node.id);
      const size = sizes.get(node.id);
      if (!target || !size) continue;
      const tex = node.inputs.texture('in')?.handle as WebGLTexture | null | undefined;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (tex) this.blit!.draw(null, {}, { uIn: tex }, { width: size.w, height: size.h });
      else {
        gl.viewport(0, 0, size.w, size.h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      if (target.width !== size.w || target.height !== size.h) {
        target.width = size.w;
        target.height = size.h;
      }
      target.getContext('2d')?.drawImage(this.canvas, 0, h - size.h, size.w, size.h, 0, 0, size.w, size.h);
    }
  }

  /** Riduce ogni uscita texture a una miniatura leggibile dalla CPU (a frame alterni). */
  private captureThumbnails(gl: WebGL2RenderingContext, graph: NonNullable<FrameGraph['graph']>): void {
    const { width, height } = VisualRenderer.THUMB;
    this.thumbTarget ??= createTarget(gl, width, height, false);
    if (this.thumbPixels.length !== width * height * 4) this.thumbPixels = new Uint8Array(width * height * 4);
    for (const node of graph.order) {
      for (const port of node.def.manifest.outputs) {
        if (port.type !== 'texture') continue;
        const buf = node.outputs.buffers.get(port.id);
        const tex = buf?.type === 'texture' ? (buf.handle as WebGLTexture | null) : null;
        if (!tex) continue;
        this.blit!.draw(this.thumbTarget, {}, { uIn: tex });
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.thumbPixels);
        // le righe di WebGL partono dal basso: si capovolgono
        const img = new ImageData(width, height);
        for (let y = 0; y < height; y++) {
          img.data.set(this.thumbPixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
        }
        this.thumbnails.set(`${node.id}.${port.id}`, img);
      }
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
