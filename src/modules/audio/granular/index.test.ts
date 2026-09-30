import { describe, expect, it } from 'vitest';
import { registerSample } from '../../../core/samples';
import { SR, audioSim, peakFreq, rms, trig } from '../../../../tests/helpers/audio';

registerSample({ id: 'sine440', name: 'seno', sampleRate: SR, channels: [Float32Array.from({ length: SR }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / SR))] });

const cloud = (params: Record<string, number>, events: ReturnType<typeof trig>[] = [], seconds = 0.6) =>
  audioSim(
    [
      { id: 'e', module: 'eventSource', config: { events } },
      { id: 'g', module: 'granular', params: { spray: 0, pitchRand: 0, size: 0.1, ...params }, config: { sample: 'sine440' } },
    ],
    [{ from: 'e.out', to: 'g.trig' }],
    ['g.out'],
  )
    .run(seconds)
    .get('g.out')![0]!;

describe('Granulare', () => {
  it('i grani conservano l altezza del campione, e la trasposizione la sposta', () => {
    expect(peakFreq(cloud({ density: 40 }), 0.2, 0.5, 200, 1000)).toBeCloseTo(440, -1);
    expect(peakFreq(cloud({ density: 40, pitch: 12 }), 0.2, 0.5, 200, 1200)).toBeCloseTo(880, -1);
  });

  it('con densità 0 suona solo ai trigger', () => {
    const x = cloud({ density: 0, size: 0.05 }, [trig(0.3)]);
    expect(rms(x, 0, 0.29 * SR)).toBe(0);
    expect(rms(x, 0.31 * SR, 0.34 * SR)).toBeGreaterThan(0.05);
    expect(rms(x, 0.4 * SR, 0.6 * SR)).toBe(0);
  });

  it('dal vivo: granula l ingresso', () => {
    const x = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number) => Math.sin(2 * Math.PI * 330 * t) } },
        { id: 'g', module: 'granular', params: { source: 1, position: 0.05, spray: 0, density: 40 } },
      ],
      [{ from: 's.out', to: 'g.in' }],
      ['g.out'],
    )
      .run(0.8)
      .get('g.out')![0]!;
    expect(peakFreq(x, 0.5, 0.75, 200, 1000)).toBeCloseTo(330, -1);
  });

  it('senza campione tace', () => {
    const x = audioSim([{ id: 'g', module: 'granular' }], [], ['g.out']).run(0.1).get('g.out')![0]!;
    expect(rms(x)).toBe(0);
  });
});
