import { describe, expect, it } from 'vitest';
import { audioSim, cents, pitchOf } from '../../../../tests/helpers/audio';

describe('Comb', () => {
  it('rumore nel comb a feedback: una nota alla frequenza, anche dal pitch di Voci', () => {
    const noise = (t: number) => Math.sin(t * 12345.678 * (1 + t)) * Math.sin(t * 9876.5);
    const run = (withPitch: boolean) =>
      audioSim(
        [
          { id: 'n', module: 'signal', config: { fn: noise } },
          { id: 'p', module: 'signal', config: { fn: () => 57 } },
          { id: 'c', module: 'comb', params: { freq: 330, feedback: 0.97, damping: 0 } },
        ],
        [{ from: 'n.out', to: 'c.in' }, ...(withPitch ? [{ from: 'p.out', to: 'c.pitch' }] : [])],
        ['c.out'],
      )
        .run(0.5)
        .get('c.out')![0]!;
    expect(Math.abs(cents(pitchOf(run(false), 0.2, 0.4), 330))).toBeLessThan(15);
    expect(Math.abs(cents(pitchOf(run(true), 0.2, 0.4), 220))).toBeLessThan(15);
  });
});
