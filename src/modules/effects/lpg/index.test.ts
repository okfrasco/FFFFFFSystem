import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms, trig } from '../../../../tests/helpers/audio';

describe('Low-pass gate', () => {
  it('chiuso finché non arriva un colpo, poi ping e ricaduta', () => {
    const sim = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number) => Math.sin(2 * Math.PI * 220 * t) } },
        { id: 'e', module: 'eventSource', config: { events: [trig(0.1)] } },
        { id: 'g', module: 'lpg', params: { decay: 0.1 } },
      ],
      [
        { from: 's.out', to: 'g.in' },
        { from: 'e.out', to: 'g.trig' },
      ],
      ['g.out', 'g.level'],
    ).run(1);
    const x = sim.get('g.out')![0]!;
    expect(rms(x, 0, 0.09 * SR)).toBeLessThan(1e-3);
    const hitLevel = rms(x, 0.1 * SR, 0.15 * SR);
    expect(hitLevel).toBeGreaterThan(0.1);
    expect(rms(x, 0.8 * SR, 0.9 * SR)).toBeLessThan(hitLevel / 50);
  });
});
