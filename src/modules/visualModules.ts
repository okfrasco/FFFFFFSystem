/** Moduli a rate frame: girano nel renderer dei visual (e nel main solo per l'editor). */

import type { ModuleDefinition } from '../core/types';
import { color } from './visual/color';
import { feedback } from './visual/feedback';
import { noiseField } from './visual/noiseField';
import { screen } from './visual/screen';

export const visualModules: ModuleDefinition[] = [noiseField, feedback, color, screen];
