import { describe, expect, it } from 'vitest';
import { SR, audioSim, peak } from '../../helpers/audio';

function osc(params: Record<string, number>, pitchFn?: (t: number) => number, seconds = 1) {
  const nodes = [{ id: 'o', module: 'oscillator', params }];
  const conns = [];
  if (pitchFn) {
    nodes.push({ id: 'p', module: 'signal', config: { fn: pitchFn } } as never);
    conns.push({ from: 'p.out', to: 'o.pitch' });
  }
  return audioSim(nodes, conns, ['o.out']).run(seconds).get('o.out')![0]!;
}

const crossings = (x: Float32Array) => {
  let n = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1]! < 0 && x[i]! >= 0) n++;
  return n;
};

describe('Oscillatore', () => {
  it('sine a 440 Hz dal parametro nota 69', () => {
    const x = osc({ wave: 0, pitch: 69, level: 1 });
    expect(crossings(x)).toBeGreaterThanOrEqual(439);
    expect(crossings(x)).toBeLessThanOrEqual(441);
    expect(peak(x)).toBeCloseTo(1, 2);
  });

  it('segue l\'ingresso pitch, con trasposizione', () => {
    const x = osc({ wave: 0, transpose: 12, level: 1 }, () => 57);
    expect(Math.abs(crossings(x) - 440)).toBeLessThanOrEqual(1);
  });

  it('saw e quadra restano limitate e centrate', () => {
    for (const wave of [2, 3]) {
      const x = osc({ wave, pitch: 60, level: 0.5 });
      expect(peak(x)).toBeLessThan(0.6);
      const mean = x.reduce((a, b) => a + b, 0) / x.length;
      expect(Math.abs(mean)).toBeLessThan(0.01);
    }
  });

  it('la larghezza dell\'impulso decide quanto tempo la quadra sta in alto', () => {
    const x = osc({ wave: 3, pitch: 40, pw: 0.25, level: 1 });
    const high = x.filter((v) => v > 0).length / x.length;
    expect(high).toBeCloseTo(0.25, 1);
  });

  it('il dente di sega ha poco aliasing (polyBLEP): niente salti enormi tra campioni vicini al fronte', () => {
    const x = osc({ wave: 2, pitch: 100, level: 1 }, undefined, 0.2);
    // senza polyBLEP il fronte è un salto di 2 in un campione
    let maxJump = 0;
    for (let i = 1; i < x.length; i++) maxJump = Math.max(maxJump, Math.abs(x[i]! - x[i - 1]!));
    expect(maxJump).toBeLessThan(1.9);
    expect(SR).toBe(48000);
  });
});
