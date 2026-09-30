import { describe, expect, it } from 'vitest';
import { registerSample } from '../../../core/samples';
import type { ControlEvent } from '../../../core/types';
import { SR, audioSim, cents, note, pitchOf } from '../../../../tests/helpers/audio';
import { sliceRange } from './index';

registerSample({ id: 'sineA', name: 'seno', sampleRate: SR, channels: [Float32Array.from({ length: SR }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / SR))] });
// quattro fette a livello costante 0.1, 0.2, 0.3, 0.4
registerSample({ id: 'steps4', name: 'gradini', sampleRate: SR, channels: [Float32Array.from({ length: 4 * 4800 }, (_, i) => 0.1 * (Math.floor(i / 4800) + 1))] });

const play = (sample: string, params: Record<string, number>, events: ControlEvent[], seconds = 0.5) =>
  audioSim(
    [
      { id: 'e', module: 'eventSource', config: { events } },
      { id: 's', module: 'sampler', params: { level: 1, ...params }, config: { sample } },
    ],
    [{ from: 'e.out', to: 's.note' }],
    ['s.out'],
  )
    .run(seconds)
    .get('s.out')![0]!;

describe('sliceRange', () => {
  it('fette uguali della zona', () => {
    expect(sliceRange(1000, 0, 1, 4, 1)).toEqual([250, 500]);
    expect(sliceRange(1000, 0.5, 1, 2, 3)).toEqual([750, 1000]);
  });
});

describe('Sampler / Slicer', () => {
  it('alla nota base suona com è, un ottava sopra va al doppio', () => {
    expect(Math.abs(cents(pitchOf(play('sineA', { root: 60 }, [note(0.01, 60, 1)]), 0.1, 0.3), 220))).toBeLessThan(5);
    expect(Math.abs(cents(pitchOf(play('sineA', { root: 60 }, [note(0.01, 72, 1)]), 0.1, 0.3), 440))).toBeLessThan(5);
  });

  it('slicer: il valore del trigger sceglie la fetta', () => {
    const x = play('steps4', { mode: 1, slices: 4 }, [{ kind: 'trig', t: 0.1, voice: 0, vel: 1, value: 2 }], 0.3);
    expect(x[Math.round(0.1 * SR) + 2000]).toBeCloseTo(0.3, 3);
    // la fetta dura 0.1 s, poi silenzio
    expect(x[Math.round(0.25 * SR)]).toBe(0);
  });

  it('loop: continua finché la nota è tenuta, poi il rilascio', () => {
    const x = play('steps4', { mode: 1, slices: 4, loop: 1, release: 0.01 }, [note(0.05, 60, 0.4)], 0.6);
    expect(x[Math.round(0.35 * SR)]).toBeCloseTo(0.1, 2);
    expect(Math.abs(x[Math.round(0.55 * SR)]!)).toBeLessThan(1e-3);
  });
});
