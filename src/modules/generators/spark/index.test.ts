import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { sparkMap } from './index';

describe('sparkMap', () => {
  it('un knob: divisione che raddoppia e probabilità che sale dentro ogni ottava', () => {
    expect(sparkMap(0)).toEqual({ division: 1, prob: 0.2 });
    expect(sparkMap(1).division).toBe(64);
    expect(sparkMap(0.5).division).toBe(8);
  });
});

describe('Spark', () => {
  it('più knob, più scintille', () => {
    const count = (s: number) => {
      const sim = simulate([TRANSPORT, { id: 's', module: 'spark', params: { spark: s } }], [{ from: 'tr.bar', to: 's.phase' }], ['s.trig']);
      sim.runTo(8);
      return sim.events('s.trig').length;
    };
    expect(count(0.2)).toBeLessThan(count(0.5));
    expect(count(0.5)).toBeLessThan(count(0.9));
  });
});
