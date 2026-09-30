import { describe, expect, it } from 'vitest';
import { SR, audioSim, onset } from '../../../../tests/helpers/audio';

const click = (t: number) => (t < 1 / SR ? 1 : 0);

describe('Delay: a tempo e ping-pong', () => {
  it('1/8 a 100 BPM: l eco arriva a 0.3 s', () => {
    const x = audioSim(
      [{ id: 's', module: 'signal', config: { fn: click } }, { id: 'd', module: 'delay', params: { sync: 1, division: 5, bpm: 100, mix: 1, feedback: 0 } }],
      [{ from: 's.out', to: 'd.in' }],
      ['d.out'],
    )
      .run(0.5)
      .get('d.out')![0]!;
    expect(onset(x, 0.1) / SR).toBeCloseTo(0.3, 2);
  });

  it('ping-pong: le eco si alternano tra i canali', () => {
    const out = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number, v: number) => (v === 0 ? click(t) : 0), voices: 2 } },
        { id: 'd', module: 'delay', params: { time: 0.1, mix: 1, feedback: 0.8, tone: 1, pingpong: 1 } },
      ],
      [{ from: 's.out', to: 'd.in' }],
      ['d.out'],
    )
      .run(0.35)
      .get('d.out')!;
    // prima eco a sinistra (0.1 s), la seconda a destra (0.2 s)
    expect(onset(out[0]!, 0.05) / SR).toBeCloseTo(0.1, 2);
    expect(onset(out[1]!, 0.05) / SR).toBeCloseTo(0.2, 2);
  });
});
