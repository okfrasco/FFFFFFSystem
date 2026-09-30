import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';
import { buildChord } from './index';

describe('Accordi', () => {
  it('Cmaj7 con il basso, drop 2, rivolto', () => {
    expect(buildChord(0, 9, 0, 0, 60, true)).toEqual([48, 60, 64, 67, 71]);
    expect(buildChord(0, 9, 0, 1, 60, false)).toEqual([55, 60, 64, 71]);
    expect(buildChord(0, 0, 1, 0, 60, false)).toEqual([64, 67, 72]);
  });

  it('la fondamentale da un cavo', () => {
    const sim = simulate(
      [
        { id: 'r', module: 'script', config: { events: [], levels: [[0, 62]] } },
        { id: 'c', module: 'chords', params: { type: 1, bass: 0 } },
      ],
      [{ from: 'r.out', to: 'c.root' }],
      ['c.chord'],
    );
    sim.runTo(0.1);
    expect(sim.values('c.chord').at(-1)).toEqual([62, 65, 69]); // Rem
  });
});
