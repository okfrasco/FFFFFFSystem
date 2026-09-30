import { describe, expect, it } from 'vitest';
import { SR, audioSim } from '../../../../tests/helpers/audio';

function env(params: Record<string, number>, gateFn: (t: number) => number, seconds = 1) {
  return audioSim(
    [{ id: 'g', module: 'signal', config: { fn: gateFn } }, { id: 'e', module: 'envelope', params }],
    [{ from: 'g.out', to: 'e.gate' }],
    ['e.out'],
  )
    .run(seconds)
    .get('e.out')![0]!;
}

describe('Inviluppo', () => {
  it('attacco lineare fino a 1, poi decadimento verso il sustain', () => {
    const x = env({ attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.1 }, (t) => (t < 0.6 ? 1 : 0));
    expect(x[Math.floor(0.05 * SR)]).toBeCloseTo(0.5, 2);
    expect(Math.max(...x.slice(0, Math.floor(0.2 * SR)))).toBeCloseTo(1, 3);
    expect(x[Math.floor(0.5 * SR)]).toBeCloseTo(0.5, 2);
  });

  it('il rilascio arriva a −60 dB nel tempo indicato', () => {
    const x = env({ attack: 0.001, decay: 0.01, sustain: 1, release: 0.2 }, (t) => (t < 0.3 ? 1 : 0));
    expect(x[Math.floor(0.3 * SR) + Math.floor(0.2 * SR)]).toBeLessThan(0.0015);
    expect(x[Math.floor(0.3 * SR) + Math.floor(0.05 * SR)]).toBeGreaterThan(0.1);
  });

  it('un retrigger riparte dal livello corrente, senza scalino a zero', () => {
    const x = env({ attack: 0.05, decay: 0.5, sustain: 0.3, release: 1 }, (t) => (t < 0.2 || t >= 0.25 ? 1 : 0));
    const f = Math.floor(0.25 * SR);
    expect(Math.abs(x[f]! - x[f - 1]!)).toBeLessThan(0.01);
    expect(x[f - 1]).toBeGreaterThan(0.2);
  });
});
