import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

function tail(r: number) {
  const sim = simulate([TRANSPORT, { id: 'm', module: 'logistic', params: { r, steps: 16 } }], [{ from: 'tr.bar', to: 'm.phase' }], ['m.trig']);
  sim.runTo(8);
  return sim.events('m.trig').map((e) => +(e as { value: number }).value.toFixed(4)).slice(-8);
}

describe('Mappa logistica', () => {
  it('r 2.8: si ferma su un valore (1 − 1/r)', () => {
    tail(2.8).forEach((x) => expect(x).toBeCloseTo(1 - 1 / 2.8, 3));
  });

  it('r 3.2: due valori che si alternano', () => {
    const t = tail(3.2);
    expect(new Set(t).size).toBe(2);
    expect(t[0]).toBe(t[2]);
  });

  it('r 3.9: caos, nessuna ripetizione breve', () => {
    expect(new Set(tail(3.9)).size).toBe(8);
  });
});
