import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms } from '../../../../tests/helpers/audio';

const impulse = (t: number) => (Math.abs(t - 0.01) < 0.5 / SR ? 1 : 0);

describe('Reverb', () => {
  it('coda stereo che decade secondo il T60', () => {
    const out = audioSim(
      [{ id: 'i', module: 'signal', config: { fn: impulse } }, { id: 'r', module: 'reverb', params: { decay: 0.5, mix: 1, size: 0.5, damping: 0 } }],
      [{ from: 'i.out', to: 'r.in' }],
      ['r.out'],
    )
      .run(1.2)
      .get('r.out')!;
    expect(out).toHaveLength(2);
    const [L, R] = out as [Float32Array, Float32Array];
    const early = rms(L, Math.floor(0.05 * SR), Math.floor(0.15 * SR));
    const late = rms(L, Math.floor(0.55 * SR), Math.floor(0.65 * SR));
    expect(early).toBeGreaterThan(0.001);
    // 0.5 s di T60 = −60 dB: mezzo secondo dopo il livello è sceso di almeno 40 dB
    expect(late / early).toBeLessThan(0.01);
    expect(L).not.toEqual(R);
  });
});
