/** Ciò che viste dei nodi e widget possono chiedere all'editor. */

import type { Engine } from '../../core/engine';

export interface EditorApi {
  readonly engine: Engine;
  /** Tempo attuale sul clock audio (0 se fermo). */
  now(): number;
  /** Cambio di parametro in corso (normalizzato), senza annulla. */
  setParamNormalized(nodeId: string, paramId: string, n: number): void;
  setParam(nodeId: string, paramId: string, value: number): void;
  /** Cambio di config in corso, senza annulla. */
  setConfig(nodeId: string, config: unknown): void;
  /** Fine di un gesto: entra nella storia dell'annulla e nel salvataggio. */
  commit(): void;
  isModulated(nodeId: string, paramId: string): boolean;
  /** Un seed nuovo per il nodo (modifica della patch). */
  newSeed(nodeId: string): void;
  /** Registra un elemento come estremo di cavo ("nodo.porta" o "nodo.param:id"). */
  registerEndpoint(endpoint: string, el: HTMLElement): void;
}

export interface Widget {
  el: HTMLElement;
  /** Parametri gestiti dal widget: non compaiono come righe. */
  handles: (paramId: string) => boolean;
  update(now: number): void;
}
