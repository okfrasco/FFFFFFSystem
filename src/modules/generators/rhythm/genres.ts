/**
 * Libreria dei generi: per ogni genere una griglia di 16 step (una battuta di
 * sedicesimi) con la probabilità di colpo per strumento, e le linee di basso
 * e di lead in gradi di scala (null = pausa). Le probabilità sono il
 * "carattere" del genere: 1 = sempre, 0.5 = spesso, 0.2 = ogni tanto.
 * Usata da Rhythm, Style Blend e Pattern.
 */

export const INSTRUMENTS = ['kick', 'snare', 'hat', 'perc'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export interface Genre {
  name: string;
  swing: number;
  drums: Record<Instrument, number[]>;
  bass: (number | null)[];
  lead: (number | null)[];
}

const g = (s: string): number[] => s.split(' ').map((x) => (x === '.' ? 0 : Number(x) / 10));
const n = (s: string): (number | null)[] => s.split(' ').map((x) => (x === '.' ? null : Number(x)));

export const GENRES: Genre[] = [
  {
    name: 'four on the floor',
    swing: 0,
    drums: {
      kick: g('10 . . . 10 . . . 10 . . . 10 . . 2'),
      snare: g('. . . . 10 . . . . . . . 10 . . .'),
      hat: g('2 . 9 . 2 . 9 . 2 . 9 . 2 . 9 3'),
      perc: g('. . . 3 . . . . . 2 . . . . 4 .'),
    },
    bass: n('. . 0 . . . 0 . . . 0 . . 7 0 .'),
    lead: n('4 . . 2 . . 0 . . . 2 . 4 . . .'),
  },
  {
    name: 'breakbeat',
    swing: 0.15,
    drums: {
      kick: g('10 . 4 . . . . . . . 9 . . 3 . .'),
      snare: g('. . . . 10 . . 3 . 3 . . 10 . . 4'),
      hat: g('8 . 8 . 8 . 8 . 8 . 8 . 8 . 8 .'),
      perc: g('. 2 . . . 2 . . . . . 3 . . . .'),
    },
    bass: n('0 . . 0 . . . . . . 3 . . 4 . .'),
    lead: n('. . 4 . . 5 . 4 . . 2 . . . 0 .'),
  },
  {
    name: 'jungle',
    swing: 0.1,
    drums: {
      kick: g('10 . . . . . . . . . 9 . . 2 . .'),
      snare: g('. . . . 10 . 3 . . 4 . . 10 . . 5'),
      hat: g('6 5 6 5 6 5 6 5 6 5 6 5 6 5 6 5'),
      perc: g('. . 2 . . 3 . . 2 . . . . 3 . 2'),
    },
    bass: n('0 . . . . . . . 0 . . . . . 5 .'),
    lead: n('. . . . 7 . . . . . 5 . 4 . . .'),
  },
  {
    name: 'electro',
    swing: 0,
    drums: {
      kick: g('10 . . 5 . . 9 . . . 9 . . . . 3'),
      snare: g('. . . . 10 . . . . . . . 10 . . .'),
      hat: g('9 5 9 5 9 5 9 5 9 5 9 5 9 5 9 5'),
      perc: g('. . . . . . . 4 . . . . . . 5 .'),
    },
    bass: n('0 0 . 0 . 0 7 . 0 0 . 0 . 5 3 .'),
    lead: n('0 . 2 . 4 . . 7 . . 4 . 2 . . .'),
  },
  {
    name: 'half-time',
    swing: 0.05,
    drums: {
      kick: g('10 . . . . . . 3 . . 6 . . . . .'),
      snare: g('. . . . . . . . 10 . . . . . . .'),
      hat: g('5 . . 5 . . 5 . . 5 . . 5 . 4 .'),
      perc: g('. . . . . 3 . . . . . . . 4 . .'),
    },
    bass: n('0 . . . . . . . . . 0 . . . -1 .'),
    lead: n('. . . . 4 . . . . . . . 2 . . .'),
  },
  {
    name: 'bossa',
    swing: 0.2,
    drums: {
      kick: g('10 . . 7 10 . . 7 10 . . 7 10 . . 7'),
      snare: g('9 . . 9 . . 9 . . . 9 . . 9 . .'),
      hat: g('7 . 7 . 7 . 7 . 7 . 7 . 7 . 7 .'),
      perc: g('. . 3 . . . . 3 . . 3 . . . . .'),
    },
    bass: n('0 . . 4 . . . . 4 . . 0 . . . .'),
    lead: n('4 . . 5 . . 4 . 2 . . . 1 . 2 .'),
  },
  {
    name: 'idm spezzato',
    swing: 0.3,
    drums: {
      kick: g('9 . . 4 . . . 3 . . . 5 . . 3 .'),
      snare: g('. . . . . 6 . . . . . . 7 . . 3'),
      hat: g('4 3 . 4 3 . 4 . 3 4 . 3 . 4 3 .'),
      perc: g('. 3 . . 4 . 3 . . 3 . . 4 . . 3'),
    },
    bass: n('0 . . . 1 . . 0 . . 3 . . . . -2'),
    lead: n('. 6 . . . 8 . . 5 . . . . 9 . .'),
  },
  {
    name: 'footwork',
    swing: 0,
    drums: {
      kick: g('10 . . 9 . . 9 . . . 9 . . 9 . .'),
      snare: g('. . . . 9 . . . . . . . 9 . . .'),
      hat: g('6 4 6 4 6 4 6 4 6 4 6 4 6 4 6 4'),
      perc: g('. . 5 . . 5 . . 5 . . 5 . . 5 .'),
    },
    bass: n('0 . . 0 . . 0 . . . 0 . . 3 . .'),
    lead: n('. . 7 . . 7 . . 5 . . . 4 . . .'),
  },
];

export const GENRE_NAMES = GENRES.map((x) => x.name);

/** Probabilità di uno strumento a uno step, con la densità (0.5 = neutra). */
export function stepProb(p: number, density: number): number {
  if (density >= 0.5) return Math.min(1, p + (1 - p) * p * (density - 0.5) * 2);
  return p * density * 2;
}

/**
 * Decisione di colpo: con `variation` 0 il pattern canonico (p ≥ 0.5), con 1
 * si pesca secondo la probabilità. `u` e `pick` sono due numeri casuali 0–1.
 */
export function decide(p: number, variation: number, u: number, pick: number): boolean {
  return pick < variation ? u < p : p >= 0.5;
}

/** Velocity dal peso del colpo nel genere: i colpi più certi sono più forti. */
export const velFor = (p: number): number => 0.45 + 0.55 * p;
