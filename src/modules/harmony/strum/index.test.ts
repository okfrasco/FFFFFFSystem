import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';

const chord = (t: number) => [60, 64, 67].map((pitch) => ({ kind: 'note', t, voice: 0, pitch, vel: 1, dur: 0.5 }));

describe('Strum', () => {
  it('in su poi in giù (alterna), 30 ms tra le note, durate accorciate', () => {
    const sim = simulate(
      [
        { id: 's', module: 'script', config: { events: [...chord(0.1), ...chord(1.1)] } },
        { id: 'u', module: 'strum', params: { time: 0.03, direction: 2, fade: 0 } },
      ],
      [{ from: 's.out', to: 'u.in' }],
      ['u.out'],
    );
    sim.runTo(1);
    const ev = sim.events('u.out').map((e) => (e.kind === 'note' ? [e.pitch, Math.round(e.t * 1000), Math.round(e.dur * 1000)] : []));
    expect(ev).toEqual([
      [60, 100, 500],
      [64, 130, 470],
      [67, 160, 440],
      [67, 1100, 500],
      [64, 1130, 470],
      [60, 1160, 440],
    ]);
  });
});
