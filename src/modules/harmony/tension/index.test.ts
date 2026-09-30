import { describe, expect, it } from 'vitest';
import { tense } from './index';

describe('Tensione', () => {
  it('sale per livelli: settima, nona, poi alterazioni', () => {
    expect(tense([60, 64, 67], 0)).toEqual([60, 64, 67]);
    expect(tense([60, 64, 67], 0.4)).toEqual([60, 64, 67, 70, 74]);
    expect(tense([60, 64, 67], 0.6)).toEqual([60, 64, 67, 70, 73, 78]);
    // minore: la settima è minore
    expect(tense([57, 60, 64], 0.2)).toEqual([57, 60, 64, 67]);
  });
});
