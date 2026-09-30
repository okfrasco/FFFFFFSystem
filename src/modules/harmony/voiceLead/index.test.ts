import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';

describe('Voice leading', () => {
  it('Do → Fa: le voci si muovono il minimo, il basso resta a parte, e suonano al cambio', () => {
    const sim = simulate(
      [
        { id: 'c', module: 'chords', params: { root: 0, type: 0, bass: 1, octave: 60 } },
        { id: 'v', module: 'voiceLead', params: { voices: 3, lo: 52, hi: 76, bass: 1 } },
      ],
      [{ from: 'c.chord', to: 'v.chord' }],
      ['v.chord', 'v.note'],
    );
    sim.runTo(0.25);
    const first = sim.values('v.chord').at(-1)!;
    expect(first[0]).toBe(48);
    sim.graph.node('c').params.setBase('root', 5);
    sim.runTo(0.5);
    const second = sim.values('v.chord').at(-1)!;
    expect(second[0]).toBe(53);
    const move = second.slice(1).reduce((s, p, i) => s + Math.abs(p - first[i + 1]!), 0);
    expect(move).toBe(3);
    expect(sim.events('v.note')).toHaveLength(8);
  });
});
