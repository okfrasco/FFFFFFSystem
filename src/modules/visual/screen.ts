/** Schermo — l'immagine che arriva qui va sul canvas della vista (la disegna il renderer). */

import type { ModuleDefinition } from '../../core/types';

export const screen: ModuleDefinition = {
  manifest: {
    id: 'screen',
    name: 'Schermo',
    category: 'visual',
    rate: 'frame',
    inputs: [{ id: 'in', type: 'texture' }],
    outputs: [],
    params: [],
    seeded: false,
  },
  create() {
    return { process() {}, getState: () => null, setState() {} };
  },
};
