/** FM: la matrice di modulazione (righe = modulato, colonne = chi modula; diagonale = feedback) e i livelli d'uscita. */

import { OPS, mId } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { matrixWidget } from '../../../ui/editor/matrixWidget';

export default function fmWidget(api: EditorApi, nodeId: string): Widget {
  return matrixWidget(api, nodeId, {
    title: 'modulazione · da (colonne) → a (righe)',
    size: OPS,
    cellId: mId,
    rowLabel: (i) => String(i + 1),
    colLabel: (j) => String(j + 1),
    extraRows: [{ label: 'out', id: (j) => `o${j + 1}` }],
    hue: 340,
  });
}
