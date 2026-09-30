import { describe, expect, it } from 'vitest';
import { PALETTES } from './index';

describe('Colore', () => {
  it('le palette hanno quattro vettori da tre componenti', () => {
    for (const { p } of PALETTES) expect(p.flat()).toHaveLength(12);
  });
});
