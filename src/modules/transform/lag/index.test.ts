import { describe, expect, it } from 'vitest';
import { slew } from './index';

describe('Lag', () => {
  it('esponenziale: 63% in un tempo di salita, discesa con il suo tempo', () => {
    let y = 0;
    for (let i = 0; i < 100; i++) y = slew(y, 1, 0.5, 0.05, 0.005, false);
    expect(y).toBeCloseTo(1 - Math.exp(-1), 3);
    let z = 1;
    for (let i = 0; i < 10; i++) z = slew(z, 0, 0.5, 0.05, 0.005, false);
    expect(z).toBeCloseTo(Math.exp(-1), 3);
  });

  it('lineare: un\'unità intera nel tempo indicato, senza superare il bersaglio', () => {
    let y = 0;
    for (let i = 0; i < 100; i++) y = slew(y, 1, 1, 1, 0.005, true);
    expect(y).toBeCloseTo(0.5, 9);
    for (let i = 0; i < 1000; i++) y = slew(y, 1, 1, 1, 0.005, true);
    expect(y).toBe(1);
  });
});
