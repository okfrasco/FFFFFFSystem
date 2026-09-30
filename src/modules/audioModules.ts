/** Moduli a rate audio: girano nell'AudioWorklet (e nel main solo per l'editor). */

import type { ModuleDefinition } from '../core/types';
import { delay } from './audio/delay';
import { drum } from './audio/drum';
import { envelope } from './audio/envelope';
import { envFollower } from './audio/envFollower';
import { filter } from './audio/filter';
import { mixer } from './audio/mixer';
import { oscillator } from './audio/oscillator';
import { output } from './audio/output';
import { reverb } from './audio/reverb';
import { vca } from './audio/vca';
import { voices } from './audio/voices';

export const audioModules: ModuleDefinition[] = [voices, oscillator, envelope, filter, vca, drum, delay, reverb, mixer, output, envFollower];
