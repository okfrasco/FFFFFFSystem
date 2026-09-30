import { describe, expect, it } from 'vitest';
import { feedbackUniforms } from '../../../src/modules/visual/feedback';
import { PALETTES } from '../../../src/modules/visual/color';
import { visualModules } from '../../../src/modules/visualModules';
import { validateManifest } from '../../../src/core/registry';

describe('nodi visual', () => {
  it('manifest validi, tutti a rate frame', () => {
    for (const m of visualModules) {
      expect(validateManifest(m.manifest)).toEqual([]);
      expect(m.manifest.rate).toBe('frame');
    }
  });

  it('il feedback non dipende dal frame rate: due frame da 1/120 = un frame da 1/60', () => {
    const p = { amount: 0.9, zoom: 0.3, rotate: 0.5, shiftX: 0.1, shiftY: 0 };
    const one = feedbackUniforms(p, 1 / 60);
    const half = feedbackUniforms(p, 1 / 120);
    expect(half.uAmount * half.uAmount).toBeCloseTo(one.uAmount, 9);
    expect(half.uZoom * half.uZoom).toBeCloseTo(one.uZoom, 9);
    expect(half.uRotate * 2).toBeCloseTo(one.uRotate, 9);
    expect(one.uAmount).toBeCloseTo(0.9, 9); // la quantità è riferita a 60 fps
  });

  it('un dt enorme (tab ferma) viene limitato', () => {
    expect(feedbackUniforms({ amount: 0.9, zoom: 1, rotate: 1, shiftX: 0, shiftY: 0 }, 5).uRotate).toBeCloseTo(0.1, 9);
  });

  it('le palette hanno quattro vettori da tre componenti', () => {
    for (const { p } of PALETTES) expect(p.flat()).toHaveLength(12);
  });
});
