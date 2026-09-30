import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';
import { moveDegrees } from './index';

const MAJ = [0, 2, 4, 5, 7, 9, 11];

describe('moveDegrees', () => {
  it('gradi della scala, attraverso l ottava e all indietro', () => {
    expect(moveDegrees(60, 2, MAJ)).toBe(64);
    expect(moveDegrees(71, 2, MAJ)).toBe(74);
    expect(moveDegrees(60, -1, MAJ)).toBe(59);
    expect(moveDegrees(61, 1, MAJ)).toBe(63); // Do♯ fuori scala: dal Do, un grado, più il semitono
  });
});

describe('Transpose', () => {
  it('note e accordi: gradi sulla scala del campo, poi ottave', () => {
    const sim = simulate(
      [
        { id: 'f', module: 'harmonicField', params: { root: 0, scale: 1, size: 3, octave: 48 } },
        { id: 's', module: 'script', config: { events: [{ kind: 'note', t: 0.1, voice: 0, pitch: 67, vel: 1, dur: 0.2 }] } },
        { id: 'x', module: 'transpose', params: { degrees: 1, octaves: 1 } },
      ],
      [
        { from: 'f.scale', to: 'x.scale' },
        { from: 'f.chord', to: 'x.chord' },
        { from: 's.out', to: 'x.note' },
      ],
      ['x.note', 'x.chord'],
    );
    sim.runTo(0.25);
    expect(sim.events('x.note').map((e) => (e.kind === 'note' ? e.pitch : 0))).toEqual([81]);
    expect(sim.values('x.chord').at(-1)).toEqual([62, 65, 69]); // Do maggiore → Rem, un'ottava sopra
  });
});
