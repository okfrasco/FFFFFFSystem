/**
 * L-system — assioma + regole espansi per N iterazioni; la stringa si legge un
 * simbolo alla volta come una melodia "a tartaruga":
 *
 *   F (o qualunque maiuscola)  suona il grado corrente e consuma uno step
 *   f  .                       pausa, consuma uno step
 *   +  -                       grado su / giù
 *   [  ]                       salva / riprende il grado (rami)
 *
 * Ogni passata della stringa è una frase: il grado riparte da 0. Dentro un
 * ramo la velocity scende, così la struttura si sente anche nelle dinamiche.
 * Mutazione: probabilità di leggere un simbolo invertito (+ ↔ −, nota ↔ pausa).
 */

import { clockHits } from '../../../core/phase';
import { STANDARD_GENERATOR_PARAMS, type ModuleDefinition } from '../../../core/types';

export interface LSystemConfig {
  axiom: string;
  rules: Record<string, string>;
}

/** Lunghezza massima della stringa espansa. */
export const LSYSTEM_MAX_LENGTH = 4096;

export function expandLSystem(cfg: LSystemConfig, iterations: number): string {
  let str = cfg.axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of str) {
      next += cfg.rules[ch] ?? ch;
      if (next.length >= LSYSTEM_MAX_LENGTH) break;
    }
    str = next.slice(0, LSYSTEM_MAX_LENGTH);
    if (str.length >= LSYSTEM_MAX_LENGTH) break;
  }
  return str;
}

interface LSystemStateData {
  pos: number;
  degree: number;
  stack: number[];
  counter: number;
}

const isNote = (c: string): boolean => c >= 'A' && c <= 'Z';
const isRest = (c: string): boolean => c === 'f' || c === '.';

export const lsystem: ModuleDefinition = {
  manifest: {
    id: 'lsystem',
    name: 'L-system',
    category: 'generators',
    rate: 'control',
    inputs: [
      { id: 'phase', type: 'phase' },
      { id: 'trig', type: 'control', signal: 'event' },
    ],
    outputs: [
      { id: 'trig', type: 'control', signal: 'event' },
      { id: 'value', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'iterations', label: 'Iterazioni', min: 0, max: 8, default: 3, kind: 'discrete' },
      { id: 'steps', label: 'Step per ciclo', min: 1, max: 64, default: 8, kind: 'discrete' },
      ...STANDARD_GENERATOR_PARAMS,
    ],
    seeded: true,
  },
  defaultConfig: { axiom: 'F', rules: { F: 'F+F-[-F.F]+F' } } satisfies LSystemConfig,

  create(init) {
    let cfg = init.config as LSystemConfig;
    let s: LSystemStateData = { pos: 0, degree: 0, stack: [], counter: 0 };
    const cache = new Map<number, string>();
    const expanded = (it: number): string => {
      let str = cache.get(it);
      if (str === undefined) cache.set(it, (str = expandLSystem(cfg, it)));
      return str;
    };

    return {
      process(ctx, inputs, outputs) {
        const counter = { n: s.counter };
        const hits = clockHits(ctx, inputs, counter);
        s.counter = counter.n;
        const trig = outputs.control('trig');
        for (const hit of hits) {
          const str = expanded(ctx.discrete('iterations', hit.key));
          if (str.length === 0) break;
          const m = ctx.param('mutation');
          // legge simboli finché uno consuma lo step (al massimo una passata intera)
          for (let guard = 0; guard < str.length; guard++) {
            if (s.pos >= str.length) s.pos = 0;
            if (s.pos === 0) {
              s.degree = 0;
              s.stack = [];
            }
            let c = str[s.pos++] as string;
            if (m > 0 && ctx.rng.chance(m)) {
              if (c === '+') c = '-';
              else if (c === '-') c = '+';
              else if (isNote(c)) c = 'f';
              else if (isRest(c)) c = 'F';
            }
            if (c === '+') s.degree++;
            else if (c === '-') s.degree--;
            else if (c === '[') s.stack.push(s.degree);
            else if (c === ']') s.degree = s.stack.pop() ?? s.degree;
            else if (isNote(c)) {
              const vel = Math.max(0.3, 1 - 0.15 * s.stack.length) * hit.vel;
              trig.events.push({ kind: 'trig', t: hit.t, voice: 0, vel, value: s.degree });
              break;
            } else if (isRest(c)) break;
          }
        }
        trig.values[0] = 1;
        outputs.control('value').values[0] = s.degree;
      },
      setConfig(config) {
        cfg = config as LSystemConfig;
        cache.clear();
      },
      getState: () => ({ ...s, stack: [...s.stack] }),
      setState(state) {
        const st = state as LSystemStateData;
        s = { ...st, stack: [...st.stack] };
      },
    };
  },
};

export default lsystem;
