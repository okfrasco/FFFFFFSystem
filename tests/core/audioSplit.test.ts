import { describe, expect, it } from 'vitest';
import { bridgeId, splitAudio } from '../../src/core/audioSplit';
import { createRegistry } from '../../src/core/registry';
import { encodeWav, renderOffline } from '../../src/core/offline';
import type { Patch } from '../../src/core/types';
import { audioModules } from '../../src/modules/audioModules';
import { bridge, clearBridges, pushBridgePacket } from '../../src/modules/audio/bridge';
import { moduleRegistry } from '../../src/modules/registry';
import { SR, audioSim, onset } from '../helpers/audio';

const audioRegistry = createRegistry([...audioModules, bridge]);

const drums: Patch = {
  version: 1,
  seed: 1,
  nodes: [
    { id: 'tr', module: 'transport', params: { bpm: 120 } },
    { id: 'eu', module: 'euclid', params: { steps: 16, pulses: 4 } },
    { id: 'kick', module: 'drum', params: { type: 0, decay: 0.02 } },
    { id: 'out', module: 'output', params: { volume: 1 } },
  ],
  connections: [
    { from: 'tr.bar', to: 'eu.phase' },
    { from: 'eu.trig', to: 'kick.trig' },
    { from: 'eu.gate', to: 'kick.param:tone', amount: 0.2 },
    { from: 'kick.out', to: 'out.in' },
  ],
};

describe('splitAudio', () => {
  it('tiene i nodi audio e trasforma i cavi dal controllo in ponti', () => {
    const s = splitAudio(drums, moduleRegistry);
    expect(s.patch.nodes.map((n) => n.id).sort()).toEqual([bridgeId('eu.gate'), bridgeId('eu.trig'), 'kick', 'out'].sort());
    expect(s.bridges).toEqual(['eu.trig', 'eu.gate']);
    expect(s.patch.connections).toContainEqual({ from: `${bridgeId('eu.gate')}.out`, to: 'kick.param:tone', amount: 0.2 });
    expect(s.patch.connections).toContainEqual({ from: 'kick.out', to: 'out.in' });
  });
});

describe('Ponte controllo → audio', () => {
  it('consegna gli eventi nel blocco giusto, tiene i valori, anticipa gli eventi in ritardo', () => {
    clearBridges();
    const sim = audioSim([{ id: 'b', module: 'bridge', config: { key: 'x' } }], [], []);
    const out = () => sim.graph.output('b', 'out') as { values: Float32Array; events: { t: number }[] };
    const blockDur = 128 / SR;
    pushBridgePacket('x', { t0: 0, t1: 0.005, values: [0.3], events: [{ kind: 'trig', t: 0.004, voice: 0, vel: 1 }] });
    sim.run(blockDur); // blocco [0, 2.67 ms): nessun evento
    expect(out().events).toEqual([]);
    expect(out().values[0]).toBeCloseTo(0.3, 6);
    sim.run(blockDur); // [2.67, 5.33): l'evento a 4 ms
    expect(out().events.map((e) => e.t)).toEqual([0.004]);
    // pacchetto arrivato tardi: l'evento esce all'inizio del blocco corrente
    pushBridgePacket('x', { t0: 0.001, t1: 0.002, values: [0.9], events: [{ kind: 'trig', t: 0.0015, voice: 0, vel: 1 }] });
    sim.run(blockDur);
    expect(out().events).toHaveLength(1);
    expect(out().events[0]!.t).toBeCloseTo(2 * blockDur, 9);
  });
});

describe('render end-to-end', () => {
  it('i colpi dell\'euclideo arrivano al campione giusto nel drum', () => {
    const r = renderOffline(drums, moduleRegistry, audioRegistry, { seconds: 2.2, sampleRate: SR });
    // E(4,16) a 120 BPM: un colpo ogni 0.5 s
    for (let k = 0; k < 4; k++) {
      const expected = Math.floor(k * 0.5 * SR);
      const found = onset(r.left, 1e-4, Math.max(0, expected - 200));
      // silenzio prima del colpo, suono dal suo campione (il seno parte da 0: al più 2 campioni)
      expect(found).toBeGreaterThanOrEqual(expected);
      expect(found - expected).toBeLessThanOrEqual(2);
    }
    expect(r.left).toEqual(r.right);
    const wav = encodeWav(r.left, r.right, r.sampleRate);
    expect(wav.byteLength).toBe(44 + r.left.length * 4);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
  });
});
