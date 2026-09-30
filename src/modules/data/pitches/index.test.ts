import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Pitches', () => {
  it('note con pausa, trasposizione e durata in step', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'p', module: 'pitches', params: { transpose: 12, length: 0.5, vel: 0.7 }, config: { notes: [60, -1, 67, 64] } }],
      [{ from: 'tr.bar', to: 'p.phase' }],
      ['p.note', 'p.pitch'],
    );
    sim.runTo(1);
    const notes = sim.events('p.note');
    expect(notes.map((e) => (e.kind === 'note' ? [e.t, e.pitch, e.vel] : []))).toEqual([
      [0, 72, 0.7],
      [1, 79, 0.7],
      [1.5, 76, 0.7],
    ].map(([t, p, v]) => [t, p, expect.closeTo(v!, 6)]));
    notes.forEach((e) => expect(e.kind === 'note' && e.dur).toBeCloseTo(0.25, 6)); // mezzo step da 0.5 s
    expect(sim.values('p.pitch').at(-1)).toEqual([76]);
  });
});
