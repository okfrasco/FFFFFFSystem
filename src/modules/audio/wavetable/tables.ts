/**
 * Tavole d'onda: 32 fotogrammi da 2048 campioni, costruiti dallo spettro
 * (ampiezza per armonica) e salvati a più livelli di banda (mipmap per
 * ottava), così le note alte non fanno aliasing.
 */

import { hash01 } from '../../../core/rng';
import { additiveCycle, fft } from '../../../core/fft';

export const TABLE_SIZE = 2048;
export const FRAMES = 32;
/** Armoniche massime di ogni livello: 1024, 512, … 1. */
export const LEVELS = 11;

export interface Wavetable {
  name: string;
  /** levels[l][f]: fotogramma f al livello l (armoniche ≤ 1024 >> l). */
  levels: Float32Array[][];
}

type Spectrum = (frame: number, h: number) => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const saw = (h: number) => 1 / h;
const square = (h: number) => (h % 2 ? 1 / h : 0);
const tri = (h: number) => (h % 2 ? (((h - 1) / 2) % 2 ? -1 : 1) / (h * h) : 0);

/** Le tavole pronte: nome e spettro per fotogramma (0–31) e armonica (1…). */
export const BUILTIN: readonly { name: string; spectrum: Spectrum }[] = [
  {
    name: 'base (sine → tri → saw → quadra)',
    spectrum: (f, h) => {
      const x = (f / (FRAMES - 1)) * 3;
      const shapes = [(k: number) => (k === 1 ? 1 : 0), tri, saw, square];
      const i = Math.min(2, Math.floor(x));
      return lerp(shapes[i]!(h), shapes[i + 1]!(h), x - i);
    },
  },
  { name: 'armonici (1 → 32)', spectrum: (f, h) => (h <= f + 1 ? 1 / Math.sqrt(h) : 0) },
  {
    name: 'formanti',
    spectrum: (f, h) => {
      const centre = 2 + f * 0.9;
      return (1 / Math.sqrt(h)) * Math.exp(-((h - centre) ** 2) / (2 * (1 + f * 0.15) ** 2)) + 0.15 * saw(h);
    },
  },
  { name: 'dispari → pari', spectrum: (f, h) => (h === 1 ? 1 : (h % 2 ? 1 - f / (FRAMES - 1) : f / (FRAMES - 1)) / h) },
  { name: 'digitale', spectrum: (f, h) => (h > 64 ? 0 : hash01(7, f, h) ** 3 / Math.sqrt(h)) },
  { name: 'pulse (larghezza)', spectrum: (f, h) => (Math.sin(Math.PI * h * (0.5 - (f / FRAMES) * 0.47)) * 2) / (Math.PI * h) },
];

/** Costruisce i livelli di banda di una serie di fotogrammi dati come spettri. */
export function buildTable(name: string, spectrum: Spectrum, frames = FRAMES): Wavetable {
  const levels: Float32Array[][] = [];
  for (let l = 0; l < LEVELS; l++) {
    const maxH = 1024 >> l;
    const row: Float32Array[] = [];
    for (let f = 0; f < frames; f++) {
      const amps = new Float64Array(Math.min(maxH, TABLE_SIZE / 2 - 1));
      for (let h = 1; h <= amps.length; h++) amps[h - 1] = spectrum(f, h);
      row.push(additiveCycle(amps, TABLE_SIZE));
    }
    levels.push(row);
  }
  normalise(levels);
  return { name, levels };
}

/** Porta il picco del livello più pieno a 1 (tutti i livelli con lo stesso guadagno). */
function normalise(levels: Float32Array[][]): void {
  let peak = 0;
  for (const fr of levels[0]!) for (const x of fr) peak = Math.max(peak, Math.abs(x));
  if (peak <= 0) return;
  for (const row of levels) for (const fr of row) for (let i = 0; i < fr.length; i++) fr[i]! /= peak;
}

/**
 * Tavola da un campione (formato "alla Serum": fotogrammi consecutivi da
 * `frameSize` campioni): ogni fotogramma passa per lo spettro, così anche
 * questa ha i livelli di banda.
 */
export function tableFromSamples(name: string, data: Float32Array, frameSize = TABLE_SIZE): Wavetable {
  const count = Math.max(1, Math.min(256, Math.floor(data.length / frameSize)));
  const spectra: Float64Array[] = [];
  for (let f = 0; f < count; f++) {
    // il fotogramma ricampionato a TABLE_SIZE punti
    const frame = new Float64Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) frame[i] = data[f * frameSize + Math.floor((i * frameSize) / TABLE_SIZE)] ?? 0;
    spectra.push(frame);
  }
  // i livelli si ottengono filtrando nel dominio della frequenza
  const levels: Float32Array[][] = [];
  const cache = spectra.map((frame) => spectrumOf(frame));
  for (let l = 0; l < LEVELS; l++) {
    const maxH = 1024 >> l;
    levels.push(cache.map((s) => fromSpectrum(s, maxH)));
  }
  normalise(levels);
  return { name, levels };
}


function spectrumOf(frame: Float64Array): { re: Float64Array; im: Float64Array } {
  const re = Float64Array.from(frame);
  const im = new Float64Array(frame.length);
  fft(re, im);
  re[0] = 0; // niente componente continua
  im[0] = 0;
  return { re, im };
}

function fromSpectrum(s: { re: Float64Array; im: Float64Array }, maxH: number): Float32Array {
  const n = s.re.length;
  const re = Float64Array.from(s.re);
  const im = Float64Array.from(s.im);
  for (let k = maxH + 1; k <= n - maxH - 1; k++) {
    re[k] = 0;
    im[k] = 0;
  }
  fft(re, im, true);
  return Float32Array.from(re);
}

const cache = new Map<string, Wavetable>();

/** Tavola pronta per indice (costruita una volta sola, condivisa). */
export function builtin(i: number): Wavetable {
  const b = BUILTIN[i] ?? BUILTIN[0]!;
  let t = cache.get(b.name);
  if (!t) cache.set(b.name, (t = buildTable(b.name, b.spectrum)));
  return t;
}

/** Livello di banda per una frequenza: il più ricco che resta sotto Nyquist. */
export function levelFor(freq: number, sampleRate: number): number {
  const maxH = (0.45 * sampleRate) / Math.max(1, freq);
  let l = 0;
  while (l < LEVELS - 1 && 1024 >> l > maxH) l++;
  return l;
}
