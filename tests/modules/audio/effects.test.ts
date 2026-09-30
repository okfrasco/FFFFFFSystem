import { describe, expect, it } from 'vitest';
import { mixToDevice } from '../../../src/modules/audio/output';
import { SR, audioSim, onset, peak, rms } from '../../helpers/audio';

const impulse = (t: number) => (Math.abs(t - 0.01) < 0.5 / SR ? 1 : 0);

describe('VCA', () => {
  it('moltiplica ingresso, cv e guadagno', () => {
    const y = audioSim(
      [
        { id: 'a', module: 'signal', config: { fn: () => 0.5 } },
        { id: 'c', module: 'signal', config: { fn: () => 0.4 } },
        { id: 'v', module: 'vca', params: { gain: 2 } },
      ],
      [{ from: 'a.out', to: 'v.in' }, { from: 'c.out', to: 'v.cv' }],
      ['v.out'],
    )
      .run(0.01)
      .get('v.out')![0]!;
    expect(y[10]).toBeCloseTo(0.4, 6);
  });
});

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

describe('Mixer e Uscita', () => {
  it('pan tutto a sinistra e livelli', () => {
    const [L, R] = audioSim(
      [
        { id: 'a', module: 'signal', config: { fn: () => 0.5 } },
        { id: 'm', module: 'mixer', params: { level1: 1, pan1: -1, master: 1 } },
      ],
      [{ from: 'a.out', to: 'm.in1' }],
      ['m.out'],
    )
      .run(0.01)
      .get('m.out')! as [Float32Array, Float32Array];
    expect(L[5]).toBeCloseTo(0.5 * Math.SQRT2, 5);
    expect(R[5]).toBeCloseTo(0, 5);
  });

  it('mixToDevice: 1 voce su entrambi i lati, 2 voci su sinistra/destra', () => {
    const dest = [new Float32Array(4), new Float32Array(4)];
    mixToDevice([new Float32Array([1, 1, 1, 1])], 0.5, dest);
    expect([dest[0]![0], dest[1]![0]]).toEqual([0.5, 0.5]);
    const d2 = [new Float32Array(4), new Float32Array(4)];
    mixToDevice([new Float32Array([1, 1, 1, 1]), new Float32Array([0, 0, 0, 0])], 1, d2);
    expect([d2[0]![0], d2[1]![0]]).toEqual([1, 0]);
  });
});
