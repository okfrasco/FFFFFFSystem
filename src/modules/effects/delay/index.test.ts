import { describe, expect, it } from 'vitest';
import { SR, audioSim, onset, peak } from '../../../../tests/helpers/audio';

const impulse = (t: number) => (Math.abs(t - 0.01) < 0.5 / SR ? 1 : 0);

describe('Delay', () => {
  it('l\'eco arriva dopo `time` e si ripete con il feedback', () => {
    const y = audioSim(
      [{ id: 'i', module: 'signal', config: { fn: impulse } }, { id: 'd', module: 'delay', params: { time: 0.1, feedback: 0.5, mix: 1, tone: 1 } }],
      [{ from: 'i.out', to: 'd.in' }],
      ['d.out'],
    )
      .run(0.5)
      .get('d.out')![0]!;
    const first = onset(y, 0.05);
    expect(Math.abs(first - (0.01 + 0.1) * SR)).toBeLessThanOrEqual(2);
    const second = onset(y, 0.05, first + 100);
    expect(Math.abs(second - first - 0.1 * SR)).toBeLessThanOrEqual(2);
    expect(peak(y, second - 5, second + 5)).toBeLessThan(peak(y, first - 5, first + 5));
  });

  it('con 2 voci resta stereo', () => {
    const out = audioSim(
      [{ id: 'i', module: 'signal', config: { fn: (t: number, v: number) => (v === 0 ? impulse(t) : 0), voices: 2 } }, { id: 'd', module: 'delay', params: { time: 0.05, mix: 1 } }],
      [{ from: 'i.out', to: 'd.in' }],
      ['d.out'],
    )
      .run(0.2)
      .get('d.out')!;
    expect(out).toHaveLength(2);
    expect(peak(out[0]!)).toBeGreaterThan(0.5);
    expect(peak(out[1]!)).toBe(0);
  });
});
