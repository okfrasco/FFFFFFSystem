import { describe, expect, it } from 'vitest';
import { analysisOutputs } from '../../../core/audioAnalysis';
import { renderOffline } from '../../../core/offline';
import type { ControlBuffer, Patch } from '../../../core/types';
import { followEnvelope } from './index';
import { audioRegistry, moduleRegistry } from '../../index';
import { SR, audioSim } from '../../../../tests/helpers/audio';

const coef = (s: number) => 1 - Math.exp(-1 / (s * SR));

describe('followEnvelope', () => {
  it('sale con l\'attacco e scende con il rilascio (63% in un tempo di costante)', () => {
    const one = new Float32Array(Math.round(0.01 * SR)).fill(1);
    const up = followEnvelope({ ms: 0, level: 0 }, one, coef(0.01), coef(0.1), false);
    expect(up.level).toBeCloseTo(1 - Math.exp(-1), 2);
    const zero = new Float32Array(Math.round(0.1 * SR));
    expect(followEnvelope({ ms: 0, level: 1 }, zero, coef(0.01), coef(0.1), false).level).toBeCloseTo(Math.exp(-1), 2);
  });
});

describe('Envelope follower', () => {
  const run = (amp: number, params: Record<string, number>) => {
    const sim = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number) => amp * Math.sin(2 * Math.PI * 200 * t) } },
        { id: 'e', module: 'envFollower', params },
      ],
      [{ from: 's.out', to: 'e.in' }],
      [],
    );
    sim.run(0.5);
    return (sim.graph.output('e', 'out') as ControlBuffer).values[0]!;
  };

  it('in RMS un seno di ampiezza A dà A/√2 × gain', () => {
    expect(run(0.5, { mode: 1, gain: 1, attack: 0.01, release: 0.3 })).toBeCloseTo(0.5 / Math.SQRT2, 1);
    expect(run(0.5, { mode: 1, gain: 2, attack: 0.01, release: 0.3 })).toBeCloseTo(2 * 0.5 / Math.SQRT2, 1);
  });

  it('in silenzio va a zero', () => {
    expect(run(0, {})).toBe(0);
  });
});

describe('analisi audio → controllo (render offline)', () => {
  it('il kick fa salire l\'Envelope follower, che nel main modula un parametro di controllo', () => {
    const patch: Patch = {
      version: 1,
      seed: 1,
      nodes: [
        { id: 'tr', module: 'transport' },
        { id: 'eu', module: 'euclid', params: { steps: 4, pulses: 4 } },
        { id: 'kick', module: 'drum', params: { type: 0, decay: 0.3 } },
        { id: 'env', module: 'envFollower', params: { attack: 0.005, release: 0.2, gain: 1 } },
        { id: 'mk', module: 'markov', params: { mutation: 0 } },
        { id: 'out', module: 'output' },
      ],
      connections: [
        { from: 'tr.bar', to: 'eu.phase' },
        { from: 'eu.trig', to: 'kick.trig' },
        { from: 'kick.out', to: 'env.in' },
        { from: 'env.out', to: 'mk.param:mutation', amount: 1 },
        { from: 'kick.out', to: 'out.in' },
      ],
    };
    const r = renderOffline(patch, moduleRegistry, audioRegistry, { seconds: 0.55, sampleRate: SR });
    expect(analysisOutputs(r.audio)).toEqual(['env.out']);
    // al secondo colpo (0.5 s) il kick è appena partito: l'inviluppo è alto
    const env = (r.control.output('env', 'out') as ControlBuffer).values[0]!;
    expect(env).toBeGreaterThan(0.1);
    expect(r.control.node('mk').ctx.param('mutation')).toBeCloseTo(Math.min(1, env), 5);
  });
});
