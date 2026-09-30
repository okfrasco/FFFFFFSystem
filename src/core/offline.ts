/**
 * Render offline di una patch: grafo di controllo e grafo audio in lockstep,
 * con gli stessi ponti che usa il browser (tick di controllo calcolati in
 * anticipo, pacchetti consegnati ai blocchi audio). Serve ai test end-to-end
 * e a esportare un WAV senza browser.
 */

import { analysisOutputs, collectAnalysis, type AnalysisPoint } from './audioAnalysis';
import { splitAudio } from './audioSplit';
import { Graph } from './graph';
import type { Registry } from './registry';
import type { Patch } from './types';
import { clearBridges, pushBridgePacket } from '../modules/_internal/bridge';
import { mixToDevice } from '../modules/io/output';

export interface RenderOptions {
  seconds: number;
  sampleRate?: number;
  tick?: number;
  lookahead?: number;
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  control: Graph;
  audio: Graph;
}

export function renderOffline(patch: Patch, mainRegistry: Registry, audioRegistry: Registry, opts: RenderOptions): Rendered {
  const sr = opts.sampleRate ?? 48000;
  const tick = opts.tick ?? 0.005;
  const lookahead = opts.lookahead ?? 0.1;
  const FRAMES = 128;
  clearBridges();
  const control = Graph.build(patch, mainRegistry);
  const split = splitAudio(patch, mainRegistry);
  const audio = Graph.build(split.patch, audioRegistry, { rate: 'audio', audio: { sampleRate: sr, frames: FRAMES } });
  const total = Math.ceil(opts.seconds * sr);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const block = [new Float32Array(FRAMES), new Float32Array(FRAMES)];
  const analysisKeys = analysisOutputs(audio);
  const points: AnalysisPoint[] = [];
  let k = 0;
  for (let start = 0; start < total; start += FRAMES) {
    const t0 = start / sr;
    while (k * tick < t0 + FRAMES / sr + lookahead) {
      const a = k * tick;
      const b = (k + 1) * tick;
      control.process(a, b);
      for (const key of split.bridges) {
        const [node, port] = key.split('.') as [string, string];
        const buf = control.output(node, port);
        if (buf.type === 'control') pushBridgePacket(key, { t0: a, t1: b, values: Array.from(buf.values), events: buf.events.map((e) => ({ ...e })) });
      }
      k++;
    }
    audio.process(t0, t0 + FRAMES / sr);
    // analisi (es. Envelope follower) verso il grafo di controllo, come fa l'host
    points.length = 0;
    collectAnalysis(audio, analysisKeys, t0 + FRAMES / sr, points);
    for (const p of points) {
      const [node, port] = p.key.split('.') as [string, string];
      const buf = control.output(node, port);
      if (buf.type === 'control') buf.values[0] = p.v;
    }
    block[0]!.fill(0);
    block[1]!.fill(0);
    for (const node of audio.order) {
      if (node.def.manifest.id !== 'output') continue;
      const input = node.inputs.audio('in');
      if (input) mixToDevice(input.channels, node.params.value('volume'), block);
    }
    for (let i = 0; i < FRAMES && start + i < total; i++) {
      left[start + i] = Math.tanh(block[0]![i]!);
      right[start + i] = Math.tanh(block[1]![i]!);
    }
  }
  return { left, right, sampleRate: sr, control, audio };
}

/** WAV PCM 16 bit stereo. */
export function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array {
  const n = left.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const dv = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i]!)) * 32767, true);
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i]!)) * 32767, true);
  }
  return new Uint8Array(buf);
}
