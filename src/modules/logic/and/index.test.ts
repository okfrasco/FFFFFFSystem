import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('AND', () => {
  it('fra due euclidei passa solo dove colpiscono entrambi', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'a', module: 'euclid', params: { steps: 16, pulses: 4 } },
        { id: 'b', module: 'euclid', params: { steps: 16, pulses: 3 } },
        { id: 'and', module: 'and' },
      ],
      [
        { from: 'tr.bar', to: 'a.phase' },
        { from: 'tr.bar', to: 'b.phase' },
        { from: 'a.trig', to: 'and.a' },
        { from: 'b.trig', to: 'and.b' },
      ],
      ['and.trig'],
    );
    sim.runTo(2);
    // x...x...x...x... ∩ x.....x....x.... = step 0 per battuta (6 e 11 non coincidono)
    expect(sim.events('and.trig').map((e) => stepOf(e.t))).toEqual([0, 16]);
  });

  it('due colpi quasi simultanei diventano uno', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'x', module: 'script', config: { events: [{ kind: 'trig', t: 0.5, voice: 0, vel: 1 }] } },
        { id: 'y', module: 'script', config: { events: [{ kind: 'trig', t: 0.5005, voice: 0, vel: 1 }] } },
        { id: 'and', module: 'and' },
      ],
      [
        { from: 'x.out', to: 'and.a' },
        { from: 'y.out', to: 'and.b' },
      ],
      ['and.trig'],
    );
    sim.runTo(1);
    expect(sim.events('and.trig').map((e) => e.t)).toEqual([0.5]);
  });

  it('un colpo passa mentre il livello dell\'altro ingresso è alto', () => {
    const trigs = [0.1, 0.6, 1.1, 1.6].map((t) => ({ kind: 'trig' as const, t, voice: 0, vel: 1 }));
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'x', module: 'script', config: { events: trigs } },
        // livello alto tra 0.5 e 1.3 s, senza eventi
        { id: 'y', module: 'script', config: { events: [], levels: [[0.5, 1], [1.3, 0]] } },
        { id: 'and', module: 'and' },
      ],
      [
        { from: 'x.out', to: 'and.a' },
        { from: 'y.out', to: 'and.b' },
      ],
      ['and.trig'],
    );
    sim.runTo(1);
    expect(sim.events('and.trig').map((e) => e.t)).toEqual([0.6, 1.1]);
  });
});

describe('AND con un gate tenuto', () => {
  it('un euclideo passa solo mentre il gate dell\'altro euclideo è alto', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'hat', module: 'euclid', params: { steps: 16, pulses: 16 } },
        { id: 'win', module: 'euclid', params: { steps: 4, pulses: 1, rotate: 1 } }, // gate alto nel secondo quarto
        { id: 'and', module: 'and' },
      ],
      [
        { from: 'tr.bar', to: 'hat.phase' },
        { from: 'tr.bar', to: 'win.phase' },
        { from: 'hat.trig', to: 'and.a' },
        { from: 'win.gate', to: 'and.b' },
      ],
      ['and.trig'],
    );
    sim.runTo(1);
    // lo step 4 coincide con l'apertura del gate: il livello è letto a fine tick, quindi passa già
    expect(sim.events('and.trig').map((e) => stepOf(e.t))).toEqual([4, 5, 6, 7]);
  });
});
