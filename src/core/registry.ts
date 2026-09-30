/**
 * Registry dei moduli: id del manifest → definizione, validata al caricamento
 * così gli errori di un modulo emergono subito e non a metà performance.
 */

import { validateParamSpec } from './params';
import type { ModuleDefinition, ModuleManifest } from './types';

export type Registry = ReadonlyMap<string, ModuleDefinition>;

export function validateManifest(m: ModuleManifest): string[] {
  const errs: string[] = [];
  const where = `modulo ${m.id}`;
  if (!m.id) errs.push('modulo senza id');
  // Ingressi e uscite hanno spazi di nomi separati: una connessione va sempre
  // da un'uscita a un ingresso, quindi un ingresso e un'uscita "ph" non sono ambigui.
  for (const ports of [m.inputs, m.outputs]) {
    const ids = new Set<string>();
    for (const p of ports) {
      if (ids.has(p.id)) errs.push(`${where}: porta duplicata ${p.id}`);
      ids.add(p.id);
      if (p.id.includes('.') || p.id.includes(':')) errs.push(`${where}: id di porta non valido ${p.id}`);
      if (p.signal && p.type !== 'control') errs.push(`${where}: signal solo su porte control (${p.id})`);
    }
  }
  const paramIds = new Set<string>();
  for (const p of m.params) {
    if (paramIds.has(p.id)) errs.push(`${where}: parametro duplicato ${p.id}`);
    paramIds.add(p.id);
    for (const e of validateParamSpec(p)) errs.push(`${where}: ${e}`);
  }
  return errs;
}

export function createRegistry(defs: readonly ModuleDefinition[]): Registry {
  const map = new Map<string, ModuleDefinition>();
  const errs: string[] = [];
  for (const d of defs) {
    errs.push(...validateManifest(d.manifest));
    if (map.has(d.manifest.id)) errs.push(`modulo duplicato: ${d.manifest.id}`);
    map.set(d.manifest.id, d);
  }
  if (errs.length) throw new Error(`Registry non valido:\n  ${errs.join('\n  ')}`);
  return map;
}
