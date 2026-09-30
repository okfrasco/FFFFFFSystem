/**
 * Catalogo dell'AudioWorklet: solo le cartelle che possono contenere moduli
 * audio (audio/, effects/, io/). Così il worklet non importa i moduli di
 * controllo e visual, e modificarli non lo tocca (vedi ui/catalog.ts).
 */

import { createRegistry, type Registry } from '../core/registry';
import type { ModuleDefinition } from '../core/types';
import { bridge } from './_internal/bridge';

const found = import.meta.glob<ModuleDefinition>('./{audio,effects,io}/*/index.ts', { eager: true, import: 'default' });

export const workletRegistry: Registry = createRegistry([
  ...Object.values(found).filter((m) => m.manifest.rate === 'audio'),
  bridge,
]);
