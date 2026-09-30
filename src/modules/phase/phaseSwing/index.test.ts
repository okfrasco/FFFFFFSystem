import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { swingWarp } from './index';

describe('swingWarp', () => {
  it('sposta il centro della coppia a 0.5 + amount/4, resta crescente', () => {
    expect(swingWarp(0.5 + 0.25 * (2 / 3), 2 / 3)).toBeCloseTo(0.5, 12);
    expect(swingWarp(0.3, 0)).toBeCloseTo(0.3, 12);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const y = swingWarp(i / 100, 1);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('Ø Swing', () => {
  it('davanti a un Clock ÷8 dritto dà gli stessi colpi dello swing interno del Clock', () => {
    const viaPhase = simulate(
      [TRANSPORT, { id: 's', module: 'phaseSwing', params: { amount: 2 / 3, division: 8 } }, { id: 'c', module: 'clock', params: { division: 8 } }],
      [
        { from: 'tr.bar', to: 's.in' },
        { from: 's.out', to: 'c.phase' },
      ],
      ['c.trig'],
    );
    const internal = simulate([TRANSPORT, { id: 'c', module: 'clock', params: { division: 8, swing: 2 / 3 } }], [{ from: 'tr.bar', to: 'c.phase' }], ['c.trig']);
    viaPhase.runTo(2);
    internal.runTo(2);
    const a = viaPhase.events('c.trig').map((e) => e.t);
    const b = internal.events('c.trig').map((e) => e.t);
    expect(a).toHaveLength(16);
    // entro 1.5 ms: dentro il tick la fase è lineare e la piegatura ha un angolo sullo step
    a.forEach((t, i) => expect(Math.abs(t - b[i]!)).toBeLessThan(0.0015));
  });

  it('vale per tutto ciò che sta a valle, anche per step più fitti', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'phaseSwing', params: { amount: 1, division: 4 } }, { id: 'c', module: 'clock', params: { division: 4 } }],
      [
        { from: 'tr.bar', to: 's.in' },
        { from: 's.out', to: 'c.phase' },
      ],
      ['c.trig'],
    );
    sim.runTo(1);
    // swing puntato sui quarti: il secondo e il quarto quarto arrivano a 3/4 della coppia
    const quarters = sim.events('c.trig').map((e) => e.t / 0.5);
    [0, 1.5, 2, 3.5].forEach((q, i) => expect(Math.abs(quarters[i]! - q) * 0.5).toBeLessThan(0.0015));
  });
});
