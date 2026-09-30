import { describe, expect, it } from 'vitest';
import { registerSample } from '../../../core/samples';
import { audioSim, brightness, cents, pitchOf } from '../../../../tests/helpers/audio';
import { BUILTIN } from './tables';

// quattro fotogrammi: armonica 1, 2, 3, 4
const data = new Float32Array(4 * 2048);
for (let f = 0; f < 4; f++) for (let i = 0; i < 2048; i++) data[f * 2048 + i] = Math.sin((2 * Math.PI * (f + 1) * i) / 2048);
registerSample({ id: 'wt4', name: 'quattro', sampleRate: 48000, channels: [data] });

describe('Wavetable da campione', () => {
  const run = (position: number) =>
    audioSim([{ id: 'w', module: 'wavetable', params: { table: BUILTIN.length, pitch: 57, position }, config: { sample: 'wt4' } }], [], ['w.out'])
      .run(0.3)
      .get('w.out')![0]!;

  it('il primo fotogramma suona la nota, l ultimo è quattro volte più brillante', () => {
    expect(Math.abs(cents(pitchOf(run(0), 0.05, 0.2), 220))).toBeLessThan(3);
    expect(brightness(run(1)) / brightness(run(0))).toBeCloseTo(4, 0);
  });
});
