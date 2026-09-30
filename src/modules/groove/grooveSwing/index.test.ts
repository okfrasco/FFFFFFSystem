import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

const clockAfter = (swing: Record<string, number>, config?: Record<string, unknown>) =>
  simulate(
    [TRANSPORT, { id: 's', module: 'grooveSwing', params: swing, ...(config ? { config } : {}) }, { id: 'c', module: 'clock', params: { division: 8 } }],
    [
      { from: 'tr.bar', to: 's.in' },
      { from: 's.out', to: 'c.phase' },
    ],
    ['c.trig'],
  );

describe('Swing continuo', () => {
  it('con amount 0 lascia la fase dritta', () => {
    const sim = clockAfter({ amount: 0, division: 8 });
    sim.runTo(1);
    sim.events('c.trig').forEach((e, i) => expect(e.t).toBeCloseTo(i * 0.25, 3));
  });

  it('con la curva piatta a 1 coincide con Ø Swing', () => {
    const curve = clockAfter({ amount: 2 / 3, division: 8 }, { curve: [1] });
    const ref = simulate(
      [TRANSPORT, { id: 's', module: 'phaseSwing', params: { amount: 2 / 3, division: 8 } }, { id: 'c', module: 'clock', params: { division: 8 } }],
      [
        { from: 'tr.bar', to: 's.in' },
        { from: 's.out', to: 'c.phase' },
      ],
      ['c.trig'],
    );
    curve.runTo(2);
    ref.runTo(2);
    const a = curve.events('c.trig').map((e) => e.t);
    const b = ref.events('c.trig').map((e) => e.t);
    expect(a).toHaveLength(16);
    a.forEach((t, i) => expect(t).toBeCloseTo(b[i]!, 4));
  });

  it('coppie diverse swingano diverso: con la curva [0, 1] solo la seconda coppia', () => {
    const sim = clockAfter({ amount: 1, division: 8 }, { curve: [0, 1] });
    sim.runTo(1);
    const t = sim.events('c.trig').map((e) => e.t);
    expect(t[1]).toBeCloseTo(0.25, 2); // prima coppia dritta
    expect(t[3]! - 0.75).toBeGreaterThan(0.05); // seconda coppia in ritardo
    expect(t[4]).toBeCloseTo(1, 3); // i battere non si muovono
  });
});
