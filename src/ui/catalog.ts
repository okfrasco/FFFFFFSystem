/**
 * Catalogo dei moduli lato browser, con la modifica dal vivo.
 *
 * È l'unico file del main thread che importa src/modules: quando un modulo di
 * controllo o visual cambia, Vite ricarica il catalogo e lo consegna qui
 * (import.meta.hot.accept); chi è iscritto sostituisce i moduli mentre suona.
 * Un modulo audio cambiato raggiunge anche l'AudioWorklet, che non si può
 * ricaricare a caldo: in quel caso Vite ricarica la pagina (la patch resta,
 * grazie al salvataggio automatico).
 */

import * as modules from '../modules';
import type { Registry } from '../core/registry';
import type { ModuleDefinition } from '../core/types';

export interface Catalog {
  main: Registry;
  frame: Registry;
  modules: readonly ModuleDefinition[];
}

const listeners = new Set<(c: Catalog, changed: string[]) => void>();
let current: Catalog = { main: modules.moduleRegistry, frame: modules.frameRegistry, modules: modules.allModules };

export function catalog(): Catalog {
  return current;
}

/** `changed`: id dei moduli nuovi, cambiati o tolti. */
export function onCatalogChange(fn: (c: Catalog, changed: string[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Id dei moduli che differiscono tra due cataloghi. */
export function diffModules(a: readonly ModuleDefinition[], b: readonly ModuleDefinition[]): string[] {
  const before = new Map(a.map((m) => [m.manifest.id, m]));
  const after = new Map(b.map((m) => [m.manifest.id, m]));
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].filter((id) => before.get(id) !== after.get(id));
}

if (import.meta.hot) {
  import.meta.hot.accept('../modules', (next) => {
    if (!next) return;
    const nextCatalog: Catalog = { main: next.moduleRegistry, frame: next.frameRegistry, modules: next.allModules };
    const changed = diffModules(current.modules, nextCatalog.modules);
    current = nextCatalog;
    for (const fn of listeners) fn(current, changed);
  });
}
