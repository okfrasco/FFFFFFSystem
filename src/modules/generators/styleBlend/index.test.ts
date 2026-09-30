import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate } from '../../../../tests/helpers/sim';

const run = (module: string, params: Record<string, number>) => {
  const sim = simulate([TRANSPORT, { id: 'x', module, params, seed: 9 }], [{ from: 'tr.bar', to: 'x.phase' }], ['x.kick', 'x.snare', 'x.hat']);
  sim.runTo(4);
  return ['x.kick', 'x.snare', 'x.hat'].map((k) => compact(sim.events(k)));
};

describe('Style Blend', () => {
  it('miscela 0 = solo A, miscela 1 = solo B (stesso seed, stessi colpi di Rhythm)', () => {
    expect(run('styleBlend', { a: 2, b: 5, blend: 0, variation: 0.5 })).toEqual(run('rhythm', { genre: 2, variation: 0.5, swing: 0 }));
    expect(run('styleBlend', { a: 2, b: 5, blend: 1, variation: 0.5 })).toEqual(run('rhythm', { genre: 5, variation: 0.5, swing: 0 }));
  });

  it('a metà strada è diversa da entrambi', () => {
    const mid = run('styleBlend', { a: 0, b: 4, blend: 0.5, variation: 0 });
    expect(mid).not.toEqual(run('rhythm', { genre: 0, variation: 0 }));
    expect(mid).not.toEqual(run('rhythm', { genre: 4, variation: 0 }));
  });
});
