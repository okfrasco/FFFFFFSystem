import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';

describe('Campo armonico', () => {
  it('Do maggiore, secondo grado a 4 note: Rem7, con la scala e un change', () => {
    const sim = simulate([{ id: 'f', module: 'harmonicField', params: { root: 0, scale: 1, degree: 2, size: 4, octave: 48 } }], [], ['f.chord', 'f.scale', 'f.change']);
    sim.runTo(0.5);
    expect(sim.values('f.chord').at(-1)).toEqual([50, 53, 57, 60]);
    expect(sim.values('f.scale').at(-1)).toEqual([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
    expect(sim.events('f.change')).toHaveLength(1);
  });

  it('prende la tonalità dal Cerchio delle quinte', () => {
    const sim = simulate(
      [
        { id: 'q', module: 'fifths', params: { root: 7 } },
        { id: 'f', module: 'harmonicField', params: { degree: 5, size: 3, octave: 48 } },
      ],
      [
        { from: 'q.scale', to: 'f.scale' },
        { from: 'q.root', to: 'f.root' },
      ],
      ['f.chord'],
    );
    sim.runTo(0.5);
    // Sol maggiore, quinto grado: Re maggiore, sopra la tonica (Sol a 55)
    expect(sim.values('f.chord').at(-1)).toEqual([62, 66, 69]);
  });
});
