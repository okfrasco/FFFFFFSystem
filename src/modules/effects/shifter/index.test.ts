import { describe, expect, it } from 'vitest';
import { SR, audioSim, cents, pitchOf } from '../../../../tests/helpers/audio';

const shift = (freq: number, params: Record<string, number>) =>
  audioSim(
    [
      { id: 's', module: 'signal', config: { fn: (t: number) => 0.5 * Math.sin(2 * Math.PI * freq * t) } },
      { id: 'x', module: 'shifter', params: { feedback: 0, mix: 1, ...params } },
    ],
    [{ from: 's.out', to: 'x.in' }],
    ['x.out'],
  )
    .run(0.5)
    .get('x.out')![0]!;

describe('Freq / Pitch Shift', () => {
  it('frequenza: 400 Hz + 100 Hz = 500 Hz, la banda sotto (300 Hz) almeno 20 dB più bassa', () => {
    const x = shift(400, { mode: 0, shift: 100 });
    const mag = (f: number) => {
      let re = 0;
      let im = 0;
      for (let i = 0.2 * SR; i < 0.4 * SR; i++) {
        re += x[i]! * Math.cos((2 * Math.PI * f * i) / SR);
        im += x[i]! * Math.sin((2 * Math.PI * f * i) / SR);
      }
      return Math.hypot(re, im) / (0.1 * SR);
    };
    expect(mag(500)).toBeGreaterThan(0.4);
    expect(20 * Math.log10(mag(500) / mag(300))).toBeGreaterThan(20);
    expect(mag(400)).toBeLessThan(0.01);
  });

  it('pitch: +12 semitoni raddoppia', () => {
    expect(Math.abs(cents(pitchOf(shift(220, { mode: 1, semitones: 12 }), 0.2, 0.4, 100, 2000), 440))).toBeLessThan(15);
  });
});
