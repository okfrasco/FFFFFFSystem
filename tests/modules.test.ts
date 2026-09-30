import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/core/registry';
import type { ModuleDefinition } from '../src/core/types';
import { allModules, audioRegistry, collectModules, frameRegistry, moduleRegistry } from '../src/modules';
import { workletRegistry } from '../src/modules/audioCatalog';

describe('catalogo dei moduli', () => {
  it('trova tutti i moduli dalle cartelle, con manifest validi', () => {
    expect(allModules.length).toBeGreaterThanOrEqual(30);
    for (const m of allModules) expect(validateManifest(m.manifest), m.manifest.id).toEqual([]);
  });

  it('i registri del worklet e dei visual prendono i moduli del loro rate (più ponti e sonde)', () => {
    for (const d of audioRegistry.values()) expect(d.manifest.rate).toBe('audio');
    for (const d of frameRegistry.values()) expect(d.manifest.rate).toBe('frame');
    expect(audioRegistry.has('bridge')).toBe(true);
    expect(frameRegistry.has('probePhase')).toBe(true);
    expect(moduleRegistry.has('bridge')).toBe(false);
    // il worklet vede gli stessi moduli audio
    expect([...workletRegistry.keys()].sort()).toEqual([...audioRegistry.keys()].sort());
  });

  it('segnala cartelle con nome o categoria sbagliati', () => {
    const def = { manifest: { id: 'foo', category: 'logic' } } as unknown as ModuleDefinition;
    expect(collectModules({ './logic/foo/index.ts': def }).errors).toEqual([]);
    expect(collectModules({ './logic/bar/index.ts': def }).errors[0]).toMatch(/cartella/);
    expect(collectModules({ './audio/foo/index.ts': def }).errors[0]).toMatch(/categoria/);
    expect(collectModules({ './logic/foo/index.ts': undefined }).errors[0]).toMatch(/export default/);
    const audioDef = { manifest: { id: 'foo', category: 'ideas', rate: 'audio' } } as unknown as ModuleDefinition;
    expect(collectModules({ './ideas/foo/index.ts': audioDef }).errors[0]).toMatch(/modulo audio/);
  });
});
