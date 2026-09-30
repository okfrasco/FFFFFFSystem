import { describe, expect, it } from 'vitest';
import { audioSim, brightness, cents, peak, pitchOf } from '../../../../tests/helpers/audio';

describe('Additivo', () => {
  const run = (params: Record<string, number>, amps: number[]) =>
    audioSim([{ id: 'a', module: 'additive', params: { pitch: 57, ...params }, config: { amps } }], [], ['a.out']).run(0.3).get('a.out')![0]!;

  it('una parziale sola: un seno al livello dato', () => {
    const x = run({ partials: 1, level: 0.5 }, [1]);
    expect(Math.abs(cents(pitchOf(x, 0.05, 0.2), 220))).toBeLessThan(3);
    expect(peak(x, 1000)).toBeCloseTo(0.5, 2);
  });

  it('inclinazione: più parziali alte = più brillante', () => {
    const amps = Array.from({ length: 32 }, () => 1);
    expect(brightness(run({ partials: 32, tilt: -0.3 }, amps))).toBeGreaterThan(brightness(run({ partials: 32, tilt: 0.8 }, amps)) * 2);
  });

  it('niente parziali sopra Nyquist', () => {
    const x = run({ partials: 64, pitch: 100 }, Array.from({ length: 64 }, () => 1));
    expect(Number.isFinite(peak(x))).toBe(true);
    // a 2.6 kHz entrano solo 8 parziali (fino a ~21 kHz): picco ≤ livello
    expect(peak(x)).toBeLessThanOrEqual(0.5001);
  });
});
