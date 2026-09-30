/**
 * Processor dell'AudioWorklet: fa girare la parte audio del grafo a blocchi
 * di 128 campioni sul clock dell'AudioContext (lo stesso dello scheduler).
 *
 * Messaggi dal main:
 *   { type: 'patch', patch }            sottopatch audio (nodi audio + ponti)
 *   { type: 'param', node, param, value }
 *   { type: 'ticks', packets }          buffer di controllo per i ponti
 *   { type: 'reset' }                   svuota le code dei ponti
 */

import { workletRegistry } from '../modules/audioCatalog';
import { analysisOutputs, collectAnalysis, type AnalysisPoint } from '../core/audioAnalysis';
import { Graph, GraphError } from '../core/graph';
import type { Patch } from '../core/types';
import { clearBridges, pushBridgePacket, type BridgePacket } from '../modules/_internal/bridge';
import { mixToDevice } from '../modules/io/output';

const FRAMES = 128;

type Message =
  | { type: 'patch'; patch: Patch }
  | { type: 'param'; node: string; param: string; value: number }
  | { type: 'ticks'; packets: (BridgePacket & { key: string })[] }
  | { type: 'reset' };

class EngineProcessor extends AudioWorkletProcessor {
  private graph: Graph | null = null;
  private analysisKeys: string[] = [];
  private analysis: AnalysisPoint[] = [];
  private blocks = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<Message>) => this.receive(e.data);
  }

  private receive(m: Message): void {
    switch (m.type) {
      case 'patch':
        try {
          this.graph = Graph.build(m.patch, workletRegistry, {
            ...(this.graph ? { reuse: this.graph } : {}),
            rate: 'audio',
            audio: { sampleRate, frames: FRAMES },
          });
          this.analysisKeys = analysisOutputs(this.graph);
        } catch (err) {
          this.port.postMessage({ type: 'error', message: err instanceof GraphError ? err.errors.join(' · ') : String(err) });
        }
        break;
      case 'param':
        if (this.graph?.has(m.node)) this.graph.setParam(m.node, m.param, m.value);
        break;
      case 'ticks':
        for (const p of m.packets) pushBridgePacket(p.key, p);
        break;
      case 'reset':
        clearBridges();
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (!out || !this.graph) return true;
    for (const ch of out) ch.fill(0);
    const t0 = currentTime;
    try {
      this.graph.process(t0, t0 + FRAMES / sampleRate);
    } catch (err) {
      this.port.postMessage({ type: 'error', message: String(err) });
      this.graph = null;
      return true;
    }
    // analisi verso il main, a gruppi di 4 blocchi (~10 ms)
    if (this.analysisKeys.length) {
      collectAnalysis(this.graph, this.analysisKeys, t0 + FRAMES / sampleRate, this.analysis);
      if (++this.blocks % 4 === 0) {
        this.port.postMessage({ type: 'analysis', points: this.analysis });
        this.analysis = [];
      }
    }
    for (const node of this.graph.order) {
      if (node.def.manifest.id !== 'output') continue;
      const input = node.inputs.audio('in');
      if (input) mixToDevice(input.channels, node.params.value('volume'), out);
    }
    // limitatore morbido: sopra ~0.8 la curva si piega verso 1
    for (const ch of out) {
      for (let i = 0; i < ch.length; i++) {
        const x = ch[i]!;
        ch[i] = Number.isFinite(x) ? Math.tanh(x) : 0;
      }
    }
    return true;
  }
}

registerProcessor('ffffff-engine', EngineProcessor);
