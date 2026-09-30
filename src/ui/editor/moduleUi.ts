/**
 * Interfaccia dei moduli trovata dalle loro cartelle: widget.ts (editor dentro
 * il nodo) e view.ts (grafica animata). La cartella ha il nome dell'id.
 */

import type { EditorApi, Widget } from './api';

export type WidgetFactory = (api: EditorApi, nodeId: string) => Widget;

const widgetFiles = import.meta.glob<WidgetFactory>('../../modules/*/*/widget.ts', { eager: true, import: 'default' });

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

const widgets = byModuleId(widgetFiles);

export function widgetFor(api: EditorApi, nodeId: string, moduleId: string): Widget | null {
  return widgets.get(moduleId)?.(api, nodeId) ?? null;
}
