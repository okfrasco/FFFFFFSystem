import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Echo', () => {
  it('ripete in secondi, con velocity che cala e note che salgono', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events: [{ kind: 'note', t: 0.1, voice: 0, pitch: 60, vel: 1, dur: 0.1 }] } },
        { id: 'e', module: 'echo', params: { time: 0.2, repeats: 3, decay: 0.5, transpose: 12 } },
      ],
      [{ from: 'src.out', to: 'e.in' }],
      ['e.out'],
    );
    sim.runTo(1);
    const ev = sim.events('e.out') as { t: number; vel: number; pitch: number }[];
    expect(ev.map((e) => +e.t.toFixed(6))).toEqual([0.1, 0.3, 0.5, 0.7]);
    expect(ev.map((e) => e.vel)).toEqual([1, 0.5, 0.25, 0.125]);
    expect(ev.map((e) => e.pitch)).toEqual([60, 72, 84, 96]);
  });

  it('con la fase il tempo è in cicli: 1/4 di battuta = 0.5 s a 120 BPM', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events: [{ kind: 'trig', t: 0.1, voice: 0, vel: 1 }] } },
        { id: 'e', module: 'echo', params: { time: 0.25, repeats: 2, decay: 0.9, dry: 0 } },
      ],
      [{ from: 'src.out', to: 'e.in' }, { from: 'tr.bar', to: 'e.phase' }],
      ['e.out'],
    );
    sim.runTo(1);
    expect(sim.events('e.out').map((e) => +e.t.toFixed(6))).toEqual([0.6, 1.1]);
  });
});
