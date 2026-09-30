import example from '../patches/demo.json';
import { Engine } from './core/engine';
import { autoLayout } from './core/patchEdit';
import type { Patch } from './core/types';
import { catalog } from './ui/catalog';
import { loadSavedPatch, mountEditor } from './ui/editor/editor';
import { Host } from './ui/host';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  const moduleRegistry = catalog().main;
  // patch salvata, altrimenti l'esempio; se non ha posizioni l'editor le calcola
  let patch = example as Patch;
  let engine: Engine | null = null;
  const saved = loadSavedPatch();
  if (saved) {
    try {
      engine = new Engine(autoLayout(saved, moduleRegistry), moduleRegistry);
      patch = saved;
    } catch {
      // salvataggio di una versione precedente non più valido: si riparte dall'esempio
    }
  }
  engine ??= new Engine(autoLayout(patch, moduleRegistry), moduleRegistry);
  const host = new Host(engine);
  // in sviluppo: accesso da console (e dai test nel browser)
  if (import.meta.env.DEV) Object.assign(window, { ffffff: { host, engine } });
  mountEditor(app, {
    host,
    example: example as Patch,
    relayout: patch.nodes.some((n) => !n.ui),
  });
}
