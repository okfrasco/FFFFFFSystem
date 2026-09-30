/**
 * Catalogo dei moduli. Ogni cartella src/modules/<categoria>/<id>/ con un
 * index.ts che esporta di default un ModuleDefinition è un modulo: compare da
 * solo nel menu, e il worklet audio e il renderer dei visual prendono quelli
 * del loro rate. Nella stessa cartella possono stare:
 *
 *   widget.ts      editor dentro il nodo (export default WidgetFactory)
 *   view.ts        grafica animata del nodo (export default ViewFactory)
 *   shader.frag    lo shader, se è un visual (import './shader.frag?raw')
 *   index.test.ts  il test a seed fisso
 *   NOTE.md        l'idea: da dove viene, cosa provare
 *
 * La cartella ha lo stesso nome dell'id del modulo e sta nella cartella della
 * sua categoria (le idee non ancora rifinite in ideas/).
 */

import { createRegistry, type Registry } from '../core/registry';
import type { ModuleDefinition } from '../core/types';
import { bridge } from './_internal/bridge';
import { probeControl, probePhase } from './_internal/probe';

const found = import.meta.glob<ModuleDefinition>('./*/*/index.ts', { eager: true, import: 'default' });

/** Moduli trovati, con la cartella da cui vengono. */
export function collectModules(files: Record<string, ModuleDefinition | undefined>): { modules: ModuleDefinition[]; errors: string[] } {
  const modules: ModuleDefinition[] = [];
  const errors: string[] = [];
  for (const path of Object.keys(files).sort()) {
    const def = files[path];
    const [, category, folder] = path.split('/');
    if (!def?.manifest) {
      errors.push(`${path}: manca "export default" del modulo`);
      continue;
    }
    if (def.manifest.id !== folder) errors.push(`${path}: la cartella deve chiamarsi come l'id (${def.manifest.id})`);
    if (def.manifest.category !== category) errors.push(`${path}: la categoria è ${def.manifest.category}, la cartella è ${category}`);
    modules.push(def);
  }
  return { modules, errors };
}

const { modules, errors } = collectModules(found);
if (errors.length) throw new Error(`Moduli non validi:\n  ${errors.join('\n  ')}`);

export const allModules: readonly ModuleDefinition[] = modules;
/** Tutti i moduli (editor, grafo di controllo). */
export const moduleRegistry: Registry = createRegistry(modules);
/** Moduli audio + ponti: il grafo dell'AudioWorklet. */
export const audioRegistry: Registry = createRegistry([...modules.filter((m) => m.manifest.rate === 'audio'), bridge]);
/** Moduli visual + sonde: il grafo del renderer. */
export const frameRegistry: Registry = createRegistry([...modules.filter((m) => m.manifest.rate === 'frame'), probePhase, probeControl]);
