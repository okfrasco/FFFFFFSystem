/**
 * Interfaccia dei moduli trovata dalle loro cartelle: widget.ts (editor dentro
 * il nodo) e view.ts (grafica animata). La cartella ha il nome dell'id.
 *
 * Modifica dal vivo: questo file accetta i propri aggiornamenti; le tabelle
 * stanno in uno stato condiviso tra le versioni, così chi le usa vede subito
 * quelle nuove e l'editor ridisegna i nodi.
 */

import type { EditorApi, Widget } from './api';

export type WidgetFactory = (api: EditorApi, nodeId: string) => Widget;

/** id del modulo (nome della cartella) → valore esportato. */
export function byModuleId<T>(files: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [path, value] of Object.entries(files)) {
    const parts = path.split('/');
    const id = parts[parts.length - 2];
    if (id) map.set(id, value);
  }
  return map;
}

interface UiTables {
  widgets: Map<string, WidgetFactory>;
  listeners: Set<() => void>;
}

const shared = (globalThis as { __ffffffModuleUi?: UiTables }).__ffffffModuleUi ??= {
  widgets: new Map(),
  listeners: new Set(),
};
shared.widgets = byModuleId(import.meta.glob<WidgetFactory>('../../modules/*/*/widget.ts', { eager: true, import: 'default' }));

export function widgetFor(api: EditorApi, nodeId: string, moduleId: string): Widget | null {
  return shared.widgets.get(moduleId)?.(api, nodeId) ?? null;
}

/** Chiamato quando widget o view cambiano (modifica dal vivo). */
export function onUiChange(fn: () => void): void {
  shared.listeners.add(fn);
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    for (const fn of shared.listeners) fn();
  });
}
