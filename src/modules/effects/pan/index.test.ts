import { describe, expect, it } from 'vitest';
import { audioSim } from '../../../../tests/helpers/audio';

describe('Pan', () => {
  it('mono a sinistra: tutto nel canale sinistro', () => {
    const out = audioSim([{ id: 's', module: 'signal', config: { fn: () => 1 } }, { id: 'p', module: 'pan', params: { pan: -1 } }], [{ from: 's.out', to: 'p.in' }], ['p.out']).run(0.01).get('p.out')!;
    expect(out[0]![10]).toBeCloseTo(1, 6);
    expect(out[1]![10]).toBeCloseTo(0, 6);
  });

  it('quattro voci con spread 1: la prima a sinistra, l ultima a destra', () => {
    const out = audioSim(
      [{ id: 's', module: 'signal', config: { fn: (_t: number, v: number) => (v === 0 ? 1 : 0), voices: 4 } }, { id: 'p', module: 'pan', params: { pan: 0, spread: 1 } }],
      [{ from: 's.out', to: 'p.in' }],
      ['p.out'],
    )
      .run(0.01)
      .get('p.out')!;
    expect(out[0]![10]).toBeCloseTo(1, 6);
    expect(out[1]![10]).toBeCloseTo(0, 6);
  });

  it('stereo con larghezza 0: mono al centro', () => {
    const out = audioSim(
      [{ id: 's', module: 'signal', config: { fn: (_t: number, v: number) => (v === 0 ? 1 : -1), voices: 2 } }, { id: 'p', module: 'pan', params: { width: 0 } }],
      [{ from: 's.out', to: 'p.in' }],
      ['p.out'],
    )
      .run(0.01)
      .get('p.out')!;
    expect(out[0]![10]).toBeCloseTo(0, 6);
    expect(out[1]![10]).toBeCloseTo(0, 6);
  });
});
