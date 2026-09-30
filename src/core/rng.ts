/**
 * RNG con seed del core. È l'unica sorgente di casualità ammessa nei moduli.
 *
 * Generatore: xoshiro128** (Blackman & Vigna), 4 × uint32 di stato,
 * inizializzato con splitmix32 a partire dal seed. Lo stato è serializzabile,
 * quindi una scena può salvarlo e riprendere la sequenza esattamente da lì.
 *
 * `fork(label)` deriva un RNG indipendente dal seed (non dallo stato corrente):
 * lo stesso label dà sempre lo stesso figlio, anche se il padre ha già
 * consumato numeri. Così aggiungere un nodo non sposta la casualità degli altri.
 *
 * `hash32` / `hash01` sono funzioni pure senza stato, usate per le soglie
 * di morph per evento: stesso input, stessa soglia, sempre.
 */

export type RngState = readonly [number, number, number, number];

export class Rng {
  /** Seed da cui è nato questo RNG (uint32). Base per `fork`. */
  readonly seed: number;
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number) {
    this.seed = toUint32(seed);
    let sm = this.seed;
    const split = (): number => {
      sm = (sm + 0x9e3779b9) | 0;
      let z = sm;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s0 = split();
    this.s1 = split();
    this.s2 = split();
    this.s3 = split();
    this.guardZero();
  }

  /** uint32 in [0, 2^32). */
  nextUint32(): number {
    const s1 = this.s1;
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Float in [0, 1). */
  float(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Intero in [lo, hi) — hi escluso. */
  int(lo: number, hi: number): number {
    if (hi <= lo) return lo;
    return lo + Math.floor(this.float() * (hi - lo));
  }

  /** true con probabilità p (p ≤ 0 mai, p ≥ 1 sempre). */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Elemento a caso di un array non vuoto. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: array vuoto');
    return items[this.int(0, items.length)] as T;
  }

  /** Indice scelto con pesi non negativi; -1 se la somma è 0. */
  weighted(weights: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i] ?? 0);
    if (total <= 0) return -1;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i] ?? 0);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Normale standard (Box-Muller). */
  gaussian(): number {
    const u = 1 - this.float(); // (0, 1]
    const v = this.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** RNG figlio indipendente, deterministico rispetto a (seed, label). */
  fork(label: string | number): Rng {
    const l = typeof label === 'number' ? toUint32(label) : hashString(label);
    return new Rng(hash32(this.seed, l));
  }

  getState(): RngState {
    return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0];
  }

  setState(state: RngState): void {
    this.s0 = state[0] | 0;
    this.s1 = state[1] | 0;
    this.s2 = state[2] | 0;
    this.s3 = state[3] | 0;
    this.guardZero();
  }

  /** Costruisce un RNG con stato esplicito (per test e ripristino da scena). */
  static fromState(seed: number, state: RngState): Rng {
    const r = new Rng(seed);
    r.setState(state);
    return r;
  }

  private guardZero(): void {
    // Lo stato tutto zero è un punto fisso di xoshiro.
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

function toUint32(n: number): number {
  if (!Number.isFinite(n)) throw new Error(`seed non valido: ${n}`);
  // Interi grandi o negativi vengono ridotti in modo stabile a 32 bit.
  return Math.trunc(n) >>> 0;
}

/** Finalizzatore di murmur3: mescola bene 32 bit. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash senza stato di una sequenza di interi → uint32. */
export function hash32(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h = fmix32((h ^ fmix32(toUint32(v) + 0x9e3779b9)) + Math.imul(h, 31));
  }
  return fmix32(h ^ values.length);
}

/** Hash senza stato → float in [0, 1). Usato per le soglie di morph. */
export function hash01(...values: number[]): number {
  return hash32(...values) / 4294967296;
}

/** Hash stabile di una stringa → uint32 (FNV-1a + fmix). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}
