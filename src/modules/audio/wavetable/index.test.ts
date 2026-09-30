import { describe, expect, it } from 'vitest';
import { audioSim, brightness, cents, pitchOf } from '../../../../tests/helpers/audio';
import { builtin, levelFor } from './tables';

describe('tavole', () => {
  it('il primo fotogramma della tavola base è un seno (la tavola è normalizzata tutta insieme)', () => {
    const f = builtin(0).levels[0]![0]!;
    const peak = Math.max(...f.map(Math.abs));
    for (const i of [0, 100, 512, 1500]) expect(f[i]! / peak).toBeCloseTo(Math.sin((2 * Math.PI * i) / 2048), 3);
  });

  it('livelli di banda: a 8.4 kHz restano due armoniche', () => {
    expect(levelFor(8372, 48000)).toBe(9);
    expect(levelFor(55, 48000)).toBe(2); // 256 armoniche: 1024 a 55 Hz andrebbero oltre Nyquist
    expect(levelFor(20, 48000)).toBe(0);
  });
});

describe('Wavetable', () => {
  const run = (params: Record<string, number>) =>
    audioSim([{ id: 'w', module: 'wavetable', params: { pitch: 57, ...params } }], [], ['w.out']).run(0.3).get('w.out')![0]!;

  it('intonata, e la posizione cambia il timbro', () => {
    expect(Math.abs(cents(pitchOf(run({ position: 0.5 }), 0.05, 0.2), 220))).toBeLessThan(3);
    expect(brightness(run({ position: 1 }))).toBeGreaterThan(brightness(run({ position: 0 })) * 2);
  });
});
