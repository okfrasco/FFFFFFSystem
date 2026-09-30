/** Tutti i moduli disponibili nell'editor. */

import { createRegistry } from '../core/registry';
import { audioModules } from './audioModules';
import { visualModules } from './visualModules';
import { aliasLfo } from './generators/aliasLfo';
import { cadence } from './generators/cadence';
import { euclid } from './generators/euclid';
import { gates } from './generators/gates';
import { lsystem } from './generators/lsystem';
import { markov } from './generators/markov';
import { steps } from './generators/steps';
import { quantize } from './harmony/quantize';
import { and } from './logic/and';
import { coinFlip } from './logic/coinflip';
import { phaseScale } from './phase/scale';
import { phaseSplit } from './phase/split';
import { transport } from './phase/transport';
import { coupling } from './transform/coupling';
import { memory } from './transform/memory';

export const moduleRegistry = createRegistry([
  transport,
  phaseScale,
  phaseSplit,
  euclid,
  gates,
  steps,
  markov,
  lsystem,
  cadence,
  aliasLfo,
  and,
  coinFlip,
  memory,
  coupling,
  quantize,
  ...audioModules,
  ...visualModules,
]);
