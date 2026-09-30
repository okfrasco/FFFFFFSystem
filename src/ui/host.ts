/**
 * Host del browser: AudioContext, scheduler e motore audio.
 *
 * Il grafo di controllo gira nel main (scheduler con lookahead); la parte
 * audio della patch gira nell'AudioWorklet. A ogni cambio di patch l'host
 * manda al worklet la sottopatch audio; a ogni tick raccoglie le uscite di
 * controllo che alimentano nodi audio e le spedisce in blocco, in anticipo,
 * così note e modulazioni arrivano al campione giusto.
 */

import workletUrl from '../worklet/engine.worklet.ts?worker&url';
import { splitAudio } from '../core/audioSplit';
import type { Engine } from '../core/engine';
import type { AnalysisPoint, ScopeFrame } from '../core/audioAnalysis';
import { Scheduler, WorkerWaker, audioContextClock } from '../core/scheduler';
import { Timeline } from '../core/timeline';
import { onSample } from '../core/samples';
import type { ControlEvent, Patch } from '../core/types';

interface Packet {
  key: string;
  t0: number;
  t1: number;
  values: number[];
  events: ControlEvent[];
}

export class Host {
  audio: AudioContext | null = null;
  node: AudioWorkletNode | null = null;
  private scheduler: Scheduler | null = null;
  private bridges: string[] = [];
  private pending: Packet[] = [];
  private readonly analysis = new Map<string, Timeline>();
  /** Ultimo blocco di ogni uscita audio (per gli oscilloscopi dell'editor). */
  readonly scopes = new Map<string, ScopeFrame>();
  /** Errori dal motore audio (per la barra di stato). */
  onError?: (message: string) => void;

  constructor(readonly engine: Engine) {
    engine.changes.add((c) => {
      if (c.kind === 'patch') this.sendPatch(c.patch);
      else if (this.isAudio(c.node)) this.node?.port.postMessage({ type: 'param', node: c.node, param: c.param, value: c.value });
    });
    engine.listeners.add((t0, t1, graph) => {
      if (!this.node) return;
      for (const key of this.bridges) {
        const [node, port] = key.split('.') as [string, string];
        if (!graph.has(node)) continue;
        const buf = graph.output(node, port);
        if (buf.type !== 'control') continue;
        this.pending.push({ key, t0, t1, values: Array.from(buf.values), events: buf.events.map((e) => ({ ...e })) });
      }
    });
  }

  private isAudio(nodeId: string): boolean {
    const pn = this.engine.patch.nodes.find((n) => n.id === nodeId);
    return pn ? this.engine.registry.get(pn.module)?.manifest.rate === 'audio' : false;
  }

  private sendPatch(patch: Patch): void {
    const split = splitAudio(patch, this.engine.registry);
    this.bridges = split.bridges;
    this.node?.port.postMessage({ type: 'patch', patch: split.patch });
  }

  /**
   * Valori misurati nell'audio: vanno in una Timeline con il loro tempo reale
   * (per i visual) e nel buffer d'uscita del nodo nel grafo del main (per i
   * nodi di controllo, che li leggono al tick successivo).
   */
  receiveAnalysis(points: readonly AnalysisPoint[]): void {
    const graph = this.engine.graph;
    for (const p of points) {
      this.analysisTimeline(p.key).push(p.t, [p.v]);
      const [node, port] = p.key.split('.') as [string, string];
      if (!graph.has(node)) continue;
      const buf = graph.output(node, port);
      if (buf.type === 'control') buf.values[0] = p.v;
    }
  }

  /** Timeline di un'uscita misurata nell'audio (creata al primo uso). */
  analysisTimeline(key: string): Timeline {
    let tl = this.analysis.get(key);
    if (!tl) this.analysis.set(key, (tl = new Timeline(1024)));
    return tl;
  }

  get running(): boolean {
    return this.scheduler?.isRunning ?? false;
  }

  /** Tempo attuale del clock audio (0 prima del primo avvio). */
  now(): number {
    return this.audio?.currentTime ?? 0;
  }

  /**
   * L'istante che si sta sentendo: il clock audio meno la latenza d'uscita,
   * così immagine e suono coincidono. Prima dell'avvio, il tempo di pagina.
   */
  displayTime(): number {
    if (!this.audio) return performance.now() / 1000;
    return this.audio.currentTime - (this.audio.outputLatency || 0) - (this.audio.baseLatency || 0);
  }

  async start(): Promise<void> {
    if (!this.audio) {
      this.audio = new AudioContext({ latencyHint: 'interactive' });
      await this.audio.audioWorklet.addModule(workletUrl);
      this.node = new AudioWorkletNode(this.audio, 'ffffff-engine', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.node.port.onmessage = (e: MessageEvent<{ type: string; message?: string; points?: AnalysisPoint[]; scopes?: ScopeFrame[] }>) => {
        if (e.data.type === 'error') this.onError?.(`audio: ${e.data.message}`);
        else if (e.data.type === 'analysis') this.receiveAnalysis(e.data.points ?? []);
        else if (e.data.type === 'scopes') for (const s of e.data.scopes ?? []) this.scopes.set(s.key, s);
      };
      this.node.connect(this.audio.destination);
      // i campioni (anche quelli caricati dopo) vanno anche al motore audio
      onSample((sample) => this.node?.port.postMessage({ type: 'sample', sample }));
      this.sendPatch(this.engine.patch);
      this.scheduler = new Scheduler(this.engine, audioContextClock(this.audio), new WorkerWaker());
      this.scheduler.onPump = () => {
        if (!this.pending.length) return;
        this.node?.port.postMessage({ type: 'ticks', packets: this.pending });
        this.pending = [];
      };
    }
    await this.audio.resume();
    this.scheduler!.start();
  }

  stop(): void {
    this.scheduler?.stop();
    this.pending = [];
    this.node?.port.postMessage({ type: 'reset' });
  }
}
