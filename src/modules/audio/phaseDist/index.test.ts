import { describe, expect, it } from 'vitest';
import { audioSim, brightness, cents, pitchOf } from '../../../../tests/helpers/audio';
import { pdSample } from './index';

describe('pdSample', () => {
  it('a piega 0 è un coseno per saw, quadra e impulso', () => {
    for (const shape of [0, 1, 2]) for (const p of [0, 0.1, 0.37, 0.8]) expect(pdSample(shape, p, 0)).toBeCloseTo(Math.cos(2 * Math.PI * p), 9);
  });
});

describe('Phase Distortion', () => {
  const run = (params: Record<string, number>) =>
    audioSim([{ id: 'p', module: 'phaseDist', params: { pitch: 57, ...params } }], [], ['p.out']).run(0.3).get('p.out')![0]!;

  it('intonata, e più piega = più brillante', () => {
    expect(Math.abs(cents(pitchOf(run({ amount: 0.5 }), 0.05, 0.2), 220))).toBeLessThan(3);
    expect(brightness(run({ amount: 0.9 }))).toBeGreaterThan(brightness(run({ amount: 0 })) * 2);
  });

  it('le forme risonanti hanno il picco sopra la fondamentale', () => {
    expect(brightness(run({ shape: 4, amount: 0.8 }))).toBeGreaterThan(brightness(run({ shape: 4, amount: 0.1 })) * 1.5);
  });
});
