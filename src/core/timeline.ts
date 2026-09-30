/**
 * Ring buffer di campioni con timestamp.
 *
 * Il grafo calcola il futuro (lookahead), ma visual e UI devono mostrare il
 * presente: registrano qui i valori per tick e li rileggono all'istante che
 * serve, con interpolazione lineare tra due campioni.
 */

export class Timeline {
  readonly capacity: number;
  readonly voices: number;
  private readonly times: Float64Array;
  private readonly data: Float64Array;
  private head = 0; // prossimo slot da scrivere
  private count = 0;

  constructor(capacity = 256, voices = 1) {
    if (capacity < 2) throw new Error('Timeline: capacity >= 2');
    this.capacity = capacity;
    this.voices = voices;
    this.times = new Float64Array(capacity);
    this.data = new Float64Array(capacity * voices);
  }

  get size(): number {
    return this.count;
  }

  /** Aggiunge un campione; i tempi devono essere crescenti. */
  push(t: number, values: ArrayLike<number>): void {
    const slot = this.head;
    this.times[slot] = t;
    for (let v = 0; v < this.voices; v++) this.data[slot * this.voices + v] = values[v] ?? values[0] ?? 0;
    this.head = (slot + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  /** Tempo del campione più vecchio e più recente (NaN se vuota). */
  range(): [number, number] {
    if (this.count === 0) return [NaN, NaN];
    return [this.times[this.slot(0)] as number, this.times[this.slot(this.count - 1)] as number];
  }

  /**
   * Valore all'istante t: interpolato tra i due campioni che lo racchiudono,
   * tenuto al primo/ultimo fuori dall'intervallo, 0 se vuota.
   */
  sample(t: number, voice = 0): number {
    if (this.count === 0) return 0;
    const v = voice % this.voices;
    // ricerca binaria sull'ordine logico 0..count-1
    let lo = 0;
    let hi = this.count - 1;
    if (t <= this.timeAt(lo)) return this.valueAt(lo, v);
    if (t >= this.timeAt(hi)) return this.valueAt(hi, v);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.timeAt(mid) <= t) lo = mid;
      else hi = mid;
    }
    const ta = this.timeAt(lo);
    const tb = this.timeAt(hi);
    const a = this.valueAt(lo, v);
    const b = this.valueAt(hi, v);
    return tb === ta ? b : a + ((t - ta) / (tb - ta)) * (b - a);
  }

  private slot(i: number): number {
    return (this.head - this.count + i + this.capacity) % this.capacity;
  }

  private timeAt(i: number): number {
    return this.times[this.slot(i)] as number;
  }

  private valueAt(i: number, v: number): number {
    return this.data[this.slot(i) * this.voices + v] as number;
  }
}
