import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { shAt, shValue } from './index';

describe('shAt', () => {
  it('a scalini tiene il valore dello step, smussato scivola verso il successivo', () => {
    expect(shAt(1, 3.2, 0)).toBe(shValue(1, 3));
    expect(shAt(1, 3.9, 0)).toBe(shValue(1, 3));
    expect(shAt(1, 3.2, 0.5)).toBe(shValue(1, 3));
    expect(shAt(1, 3.9999, 1)).toBeCloseTo(shValue(1, 4), 3);
  });
});

describe('S&H Random', () => {
  it('un valore per step, tra lo e hi, e il trigger lo porta', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'shRandom', params: { steps: 4, lo: 0.2, hi: 0.4 } }],
      [{ from: 'tr.bar', to: 's.phase' }],
      ['s.trig', 's.out'],
    );
    sim.runTo(2);
    const vals = sim.events('s.trig').map((e) => (e as { value: number }).value);
    expect(vals).toHaveLength(8);
    for (const x of vals) {
      expect(x).toBeGreaterThanOrEqual(0.2);
      expect(x).toBeLessThanOrEqual(0.4);
    }
    // l'uscita a metà del secondo step è il valore del secondo trigger
    expect(sim.values('s.out')[150]![0]).toBeCloseTo(vals[1]!, 9);
  });
});
