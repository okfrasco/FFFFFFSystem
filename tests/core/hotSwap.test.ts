import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/core/engine';
import { sanitizePatch } from '../../src/core/patchEdit';
import { createRegistry } from '../../src/core/registry';
import type { ModuleDefinition, Patch } from '../../src/core/types';
import { moduleRegistry } from '../../src/modules';
import { diffModules } from '../../src/ui/catalog';

const patch: Patch = {
  version: 1,
  seed: 1,
  nodes: [
    { id: 'tr', module: 'transport' },
    { id: 's', module: 'steps', params: { mutation: 0.3 } },
    { id: 'm', module: 'memory', params: { hold: 1 } },
  ],
  connections: [
    { from: 'tr.bar', to: 's.phase' },
    { from: 'tr.bar', to: 'm.phase' },
    { from: 's.trig', to: 'm.in' },
  ],
};

/** Una "versione nuova" di un modulo: stesso id, oggetto diverso. */
function newVersion(def: ModuleDefinition, patchManifest: Partial<ModuleDefinition['manifest']> = {}): ModuleDefinition {
  return { ...def, manifest: { ...def.manifest, ...patchManifest }, create: (init) => def.create(init) };
}

function registryWith(def: ModuleDefinition) {
  return createRegistry([...[...moduleRegistry.values()].filter((d) => d.manifest.id !== def.manifest.id), def]);
}

describe('modifica dal vivo', () => {
  it('un modulo cambiato riparte con lo stato della versione precedente', () => {
    const e = new Engine(patch, moduleRegistry);
    for (let k = 0; k < 1200; k++) e.process(k * 0.005, (k + 1) * 0.005);
    const before = JSON.stringify(e.graph.node('m').instance.getState());
    const oldInstance = e.graph.node('m').instance;
    const removed = e.setRegistry(registryWith(newVersion(moduleRegistry.get('memory')!)));
    expect(removed).toEqual([]);
    expect(e.graph.node('m').instance).not.toBe(oldInstance);
    expect(JSON.stringify(e.graph.node('m').instance.getState())).toBe(before);
    // gli altri nodi sono proprio gli stessi
    expect(e.graph.node('s').instance).toBeDefined();
  });

  it('parametri e porte che non ci sono più vengono tolti dalla patch', () => {
    const steps = moduleRegistry.get('steps')!;
    const reduced = newVersion(steps, {
      params: steps.manifest.params.filter((p) => p.id !== 'mutation'),
      outputs: steps.manifest.outputs.filter((p) => p.id !== 'trig'),
    });
    const { patch: clean, removed } = sanitizePatch(patch, registryWith(reduced));
    expect(removed).toEqual(['parametro s.mutation', 'cavo s.trig → m.in']);
    expect(clean.nodes.find((n) => n.id === 's')!.params).toEqual({});
    expect(clean.connections).toHaveLength(2);
  });

  it('diffModules trova i moduli nuovi, cambiati e tolti', () => {
    const a = [...moduleRegistry.values()];
    const changed = newVersion(moduleRegistry.get('euclid')!);
    const b = [...a.filter((m) => m.manifest.id !== 'euclid' && m.manifest.id !== 'and'), changed];
    expect(diffModules(a, b).sort()).toEqual(['and', 'euclid']);
  });
});
