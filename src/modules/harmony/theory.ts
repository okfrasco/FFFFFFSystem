/**
 * Teoria comune ai nodi di armonia: classi di altezza, modi per brightness,
 * cerchio delle quinte, accordi, varianti di Sus Slash, voice leading.
 *
 * Il campo armonico viaggia sui cavi con tre porte (nessun tipo nuovo):
 *   chord   poly value: le note MIDI dell'accordo, dal basso in su (voce 0 = basso)
 *   scale   poly value a 12 voci: 1 se la classe di altezza (Do = 0) è nella scala
 *   change  evento: un trigger a ogni cambio, con la fondamentale come valore
 */

import type { ControlBuffer } from '../../core/types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const pc = (p: number): number => ((Math.round(p) % 12) + 12) % 12;

/** Nome di una nota MIDI con Do centrale = C3 (60), come in Ableton. */
export const noteName = (p: number): string => `${NOTE_NAMES[pc(p)]}${Math.floor(Math.round(p) / 12) - 2}`;

/** I sette modi dal più luminoso al più scuro: ognuno abbassa una nota del precedente. */
export const MODES: readonly { name: string; steps: readonly number[] }[] = [
  { name: 'lidio', steps: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'ionio', steps: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'misolidio', steps: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'dorico', steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'eolio', steps: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'frigio', steps: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'locrio', steps: [0, 1, 3, 5, 6, 8, 10] },
];

/** Scale del Campo armonico: prima i modi per brightness, poi le altre. */
export const FIELD_SCALES: readonly { name: string; steps: readonly number[] }[] = [
  ...MODES,
  { name: 'minore armonica', steps: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'minore melodica', steps: [0, 2, 3, 5, 7, 9, 11] },
  { name: 'pentatonica maggiore', steps: [0, 2, 4, 7, 9] },
  { name: 'pentatonica minore', steps: [0, 3, 5, 7, 10] },
  { name: 'esatonale', steps: [0, 2, 4, 6, 8, 10] },
  { name: 'diminuita', steps: [0, 2, 3, 5, 6, 8, 9, 11] },
  { name: 'cromatica', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

/**
 * Brightness modale continua: la posizione `n` scende di un modo alla volta
 * (lidio → locrio); dopo il locrio di Do si passa al lidio di Si, e così via.
 * Ogni passo abbassa una sola nota: è il giro delle armature per quinte.
 */
export function brightnessMode(root: number, n: number): { root: number; mode: number } {
  const turns = Math.floor(n / 7);
  return { root: pc(root - turns), mode: n - turns * 7 };
}

/** Posizione sul cerchio delle quinte di un intervallo, da −5 (scuro) a +6 (luminoso). */
export function fifthsPos(interval: number): number {
  const k = (pc(interval) * 7) % 12;
  return k > 6 ? k - 12 : k;
}

/** Classi di altezza assolute di una scala. */
export function scalePcs(root: number, steps: readonly number[]): number[] {
  return [...new Set(steps.map((s) => pc(root + s)))].sort((a, b) => a - b);
}

export function maskOf(pcs: readonly number[]): number[] {
  const m = new Array<number>(12).fill(0);
  for (const p of pcs) m[pc(p)] = 1;
  return m;
}

export function pcsOfMask(mask: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) if ((mask[i] ?? 0) > 0.5) out.push(i);
  return out;
}

/** Legge la porta `scale` (12 voci); null se scollegata o vuota. */
export function readScale(buf: ControlBuffer | undefined): number[] | null {
  if (!buf || buf.values.length < 12) return null;
  const pcs = pcsOfMask(buf.values);
  return pcs.length ? pcs : null;
}

/** Legge la porta `chord`: le note, senza gli zeri di un buffer appena allocato. */
export function readChord(buf: ControlBuffer | undefined): number[] {
  if (!buf) return [];
  return Array.from(buf.values).filter((p) => p > 0);
}

/** Scrive un accordo e una scala sulle porte del campo. */
export function writeField(outChord: (voices: number) => ControlBuffer, outScale: (voices: number) => ControlBuffer | null, chord: readonly number[], scale: readonly number[]): void {
  const c = outChord(Math.max(1, chord.length));
  chord.forEach((p, i) => (c.values[i] = p));
  const s = outScale(12);
  if (s) maskOf(scale).forEach((x, i) => (s.values[i] = x));
}

export const sameNotes = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

// ─── Accordi ────────────────────────────────────────────────────────────────

/**
 * Accordo per terze sovrapposte su un grado della scala (classi assolute in
 * ordine, `scale` crescente): `size` note (3 = triade, 4 = settima…), le
 * estensioni sopra l'ottava.
 */
export function diatonicChord(scale: readonly number[], degree: number, size: number): number[] {
  const n = scale.length;
  if (n === 0) return [];
  const d = ((degree % n) + n) % n;
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const k = d + 2 * i;
    out.push(scale[k % n]! + 12 * Math.floor(k / n));
  }
  return out;
}

export const CHORD_TYPES: readonly { name: string; iv: readonly number[] }[] = [
  { name: 'maggiore', iv: [0, 4, 7] },
  { name: 'minore', iv: [0, 3, 7] },
  { name: 'dim', iv: [0, 3, 6] },
  { name: 'aum', iv: [0, 4, 8] },
  { name: 'sus2', iv: [0, 2, 7] },
  { name: 'sus4', iv: [0, 5, 7] },
  { name: '6', iv: [0, 4, 7, 9] },
  { name: 'm6', iv: [0, 3, 7, 9] },
  { name: '7', iv: [0, 4, 7, 10] },
  { name: 'maj7', iv: [0, 4, 7, 11] },
  { name: 'm7', iv: [0, 3, 7, 10] },
  { name: 'm(maj7)', iv: [0, 3, 7, 11] },
  { name: 'm7♭5', iv: [0, 3, 6, 10] },
  { name: 'dim7', iv: [0, 3, 6, 9] },
  { name: '7sus4', iv: [0, 5, 7, 10] },
  { name: '9', iv: [0, 4, 7, 10, 14] },
  { name: 'maj9', iv: [0, 4, 7, 11, 14] },
  { name: 'm9', iv: [0, 3, 7, 10, 14] },
  { name: '7♭9', iv: [0, 4, 7, 10, 13] },
  { name: '7♯9', iv: [0, 4, 7, 10, 15] },
  { name: '11', iv: [0, 7, 10, 14, 17] },
  { name: 'm11', iv: [0, 3, 7, 10, 14, 17] },
  { name: 'maj7♯11', iv: [0, 4, 7, 11, 14, 18] },
  { name: '13', iv: [0, 4, 7, 10, 14, 21] },
  { name: '7alt', iv: [0, 4, 10, 13, 15, 20] },
];

/** Rivolto: le prime `inv` note salgono di un'ottava. */
export function invert(notes: readonly number[], inv: number): number[] {
  const out = [...notes].sort((a, b) => a - b);
  for (let i = 0; i < inv && out.length > 0; i++) out.push(out.shift()! + 12);
  return out;
}

/** Voicing aperto "drop 2": la seconda nota dall'alto scende di un'ottava. */
export function drop2(notes: readonly number[]): number[] {
  if (notes.length < 4) return [...notes];
  const s = [...notes].sort((a, b) => a - b);
  s[s.length - 2]! -= 12;
  return s.sort((a, b) => a - b);
}

// ─── Sus Slash ──────────────────────────────────────────────────────────────

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface SusVariant {
  name: string;
  /** Intervalli della struttura sopra la sua nota più bassa. */
  iv: readonly number[];
  /** Bassi possibili, come intervallo dalla nota più bassa del sus. */
  basses: readonly number[];
  /** Bassi possibili ma i più tosti: esclusi quando Tensione è bassa. */
  tough: readonly number[];
  /** Scala per le melodie; assente = la scala diatonica più vicina che contiene accordo e basso. */
  scale?: readonly number[];
  /** Lo stack cresce con il parametro Note (quartale, quintale). */
  stack?: number;
}

/**
 * Le varianti di Sus Slash, con i bassi che funzionano (dall'utente):
 * sus: tutti, i più tosti ♭2 e ♯4 (per Csus: C♯ e F♯); sus♭5: la scala lidia
 * della nota bassa del sus; sus♯5: la minore della stessa nota più la terza
 * maggiore; sus♭2: un po' tutti; sus♭2♭5: lidio più la quarta; sus♭2♯5: la
 * maggiore. Quartale e quintale: tutti, come il sus (e gli stessi più tosti:
 * questa è una scelta mia, da confermare). Le scale per le melodie sono la
 * scala dei bassi più le note dell'accordo che non ci stanno.
 */
export const SUS_VARIANTS: readonly SusVariant[] = [
  { name: 'sus', iv: [0, 5, 7], basses: ALL, tough: [1, 6] },
  { name: 'sus♭5', iv: [0, 5, 6], basses: [0, 2, 4, 6, 7, 9, 11], tough: [], scale: [0, 2, 4, 5, 6, 7, 9, 11] },
  { name: 'sus♯5', iv: [0, 5, 8], basses: [0, 2, 3, 4, 5, 7, 8, 10], tough: [], scale: [0, 2, 3, 4, 5, 7, 8, 10] },
  { name: 'sus♭2', iv: [0, 1, 7], basses: ALL, tough: [] },
  { name: 'sus♭2♭5', iv: [0, 1, 6], basses: [0, 2, 4, 5, 6, 7, 9, 11], tough: [], scale: [0, 1, 2, 4, 5, 6, 7, 9, 11] },
  { name: 'sus♭2♯5', iv: [0, 1, 8], basses: [0, 2, 4, 5, 7, 9, 11], tough: [], scale: [0, 1, 2, 4, 5, 7, 8, 9, 11] },
  { name: 'quartale', iv: [0, 5], basses: ALL, tough: [1, 6], stack: 5 },
  { name: 'quintale', iv: [0, 7], basses: ALL, tough: [1, 6], stack: 7 },
];

/** Struttura del sus (intervalli), con gli stack allungati a `notes` note. */
export function susStructure(v: SusVariant, notes: number): number[] {
  if (!v.stack) return [...v.iv];
  return Array.from({ length: Math.max(2, notes) }, (_, i) => i * v.stack!);
}

/**
 * Bassi utilizzabili (intervalli dalla nota del sus) ordinati per brightness:
 * dal più scuro al più luminoso sul cerchio delle quinte. Con `tension` < 0.5
 * i bassi più tosti restano fuori.
 */
export function susBasses(v: SusVariant, tension: number): number[] {
  const list = v.basses.filter((b) => tension >= 0.5 || !v.tough.includes(b));
  return [...list].sort((a, b) => fifthsPos(a) - fifthsPos(b));
}

/** Scala diatonica (una delle 12 armature) che contiene tutte le classi date, la più vicina a `root`; null se nessuna. */
export function diatonicFor(pcs: readonly number[], root: number): number[] | null {
  let best: number[] | null = null;
  let bestDist = Infinity;
  for (let k = -6; k <= 6; k++) {
    const tonic = pc(root + 7 * k);
    const set = scalePcs(tonic, MODES[1]!.steps);
    if (pcs.every((p) => set.includes(pc(p))) && Math.abs(k) < bestDist) {
      bestDist = Math.abs(k);
      best = set;
    }
  }
  return best;
}

// ─── Voice leading ──────────────────────────────────────────────────────────

/** Tutte le permutazioni di un array (piccolo). */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

/** La nota della classe `p` più vicina a `near`, dentro [lo, hi]. */
export function nearestOf(p: number, near: number, lo: number, hi: number): number {
  let best = lo + pc(p - lo);
  for (let x = best; x <= hi; x += 12) if (Math.abs(x - near) < Math.abs(best - near)) best = x;
  return best;
}

/**
 * Voicing di `pcs` a `voices` voci che si muove il meno possibile da `prev`
 * (somma dei movimenti). Con più voci che note si raddoppiano le prime classi
 * (fondamentale, quinta…); con meno, si tengono le prime. `bass` (se c'è)
 * resta la nota più bassa, a parte.
 */
export function voiceLead(prev: readonly number[], pcs: readonly number[], voices: number, lo: number, hi: number): number[] {
  if (pcs.length === 0 || voices < 1) return [];
  const pool: number[] = [];
  for (let i = 0; pool.length < voices; i++) pool.push(pcs[i % pcs.length]!);
  const start = prev.length === voices ? [...prev].sort((a, b) => a - b) : spreadVoicing(pool, lo, hi);
  let best: number[] = [];
  let bestCost = Infinity;
  for (const perm of permutations(pool)) {
    const notes = perm.map((p, i) => nearestOf(p, start[i]!, lo, hi));
    const cost = notes.reduce((s, x, i) => s + Math.abs(x - start[i]!), 0);
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = notes;
    }
  }
  return best.sort((a, b) => a - b);
}

/** Voicing di partenza: le classi in fila dal centro del registro. */
function spreadVoicing(pool: readonly number[], lo: number, hi: number): number[] {
  const mid = Math.round((lo + hi) / 2) - 6;
  let last = mid - 1;
  return pool.map((p) => {
    let x = last + 1 + pc(p - last - 1);
    if (x > hi) x -= 12;
    last = x;
    return x;
  });
}

// ─── Tonnetz ────────────────────────────────────────────────────────────────

export interface Triad {
  root: number;
  minor: boolean;
}

/** Trasformazioni neo-riemanniane: P (parallela), L (scambio della sensibile), R (relativa). */
export function plr(t: Triad, op: 'P' | 'L' | 'R'): Triad {
  if (op === 'P') return { root: t.root, minor: !t.minor };
  if (op === 'L') return t.minor ? { root: pc(t.root - 4), minor: false } : { root: pc(t.root + 4), minor: true };
  return t.minor ? { root: pc(t.root + 3), minor: false } : { root: pc(t.root - 3), minor: true };
}

export const triadPcs = (t: Triad): number[] => [t.root, pc(t.root + (t.minor ? 3 : 4)), pc(t.root + 7)];
