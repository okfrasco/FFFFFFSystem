import { describe, expect, it } from 'vitest';
import { DRUM_TYPES } from '../../../src/modules/audio/drum';
import { SR, audioSim, onset, peak, rms, trig } from '../../helpers/audio';

function hit(type: number, t = 0.0503, seed = 1, params: Record<string, number> = {}) {
  return audioSim(
    [{ id: 'src', module: 'eventSource', config: { events: [trig(t, 0.9)] } }, { id: 'd', module: 'drum', params: { type, ...params } }],
    [{ from: 'src.out', to: 'd.trig' }],
    ['d.out'],
    seed,
  )
    .run(1)
    .get('d.out')![0]!;
}

describe('Drum voice', () => {
  it('ogni tipo è silenzioso prima del colpo, suona dal campione del colpo e poi decade', () => {
    DRUM_TYPES.forEach((_, type) => {
      const x = hit(type);
      const f = Math.floor(0.0503 * SR);
      expect(peak(x, 0, f)).toBe(0);
      expect(onset(x, 1e-4)).toBeGreaterThanOrEqual(f);
      expect(onset(x, 1e-4)).toBeLessThan(f + 64);
      expect(peak(x, f, f + 0.05 * SR)).toBeGreaterThan(0.05);
      expect(rms(x, Math.floor(0.9 * SR))).toBeLessThan(rms(x, f, f + 0.05 * SR) / 10);
      expect(x.every(Number.isFinite)).toBe(true);
    });
  });

  it('stesso seed stesso suono (anche il rumore)', () => {
    expect(hit(1, 0.05, 3)).toEqual(hit(1, 0.05, 3));
    expect(hit(1, 0.05, 3)).not.toEqual(hit(1, 0.05, 4));
  });

  it('il decadimento allunga la coda', () => {
    const short = hit(0, 0.05, 1, { decay: 0.1 });
    const long = hit(0, 0.05, 1, { decay: 0.8 });
    expect(rms(long, Math.floor(0.4 * SR), Math.floor(0.5 * SR))).toBeGreaterThan(rms(short, Math.floor(0.4 * SR), Math.floor(0.5 * SR)) * 10);
  });
});
