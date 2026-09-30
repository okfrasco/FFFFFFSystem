import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../../core/registry';
import transform from './index';

describe('Transform', () => {
  // lo shader si prova nel browser; qui il manifest
  it('manifest valido, a rate frame', () => {
    expect(validateManifest(transform.manifest)).toEqual([]);
    expect(transform.manifest.rate).toBe('frame');
  });
});
