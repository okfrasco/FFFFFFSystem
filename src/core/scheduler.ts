/**
 * Scheduler a frequenza di controllo con lookahead.
 *
 * Il tempo musicale viene solo dal clock (in pratica `AudioContext.currentTime`).
 * Il waker serve a svegliare lo scheduler ogni ~25 ms: a ogni risveglio si
 * calcolano tutti i tick che cadono entro `now + lookahead`. Il jitter del
 * waker quindi non tocca il timing, che è deciso dai timestamp dei tick.
 *
 * I tempi dei tick sono `origin + k · tickDuration` con k intero, così non
 * accumulano errore di arrotondamento.
 */

export interface Clock {
  /** Secondi, monotono. */
  now(): number;
}

export interface Waker {
  start(intervalMs: number, wake: () => void): void;
  stop(): void;
}

export interface TickTarget {
  process(t0: number, t1: number): void;
}

export interface SchedulerOptions {
  /** Durata di un tick di controllo, secondi. Default 5 ms. */
  tickDuration?: number;
  /** Quanto avanti rispetto al clock si calcola, secondi. Default 100 ms. */
  lookahead?: number;
  /** Intervallo del waker, ms. Default 25. */
  wakeInterval?: number;
  /** Ritardo del primo tick dopo start, secondi. Default 50 ms. */
  startDelay?: number;
  /**
   * Se lo scheduler resta indietro più di così (tab congelata, debugger),
   * salta in avanti invece di recuperare a raffica eventi già passati.
   * Default 250 ms.
   */
  maxLateness?: number;
}

export interface SchedulerStats {
  ticks: number;
  /** Quante volte si è saltato in avanti per ritardo eccessivo. */
  dropouts: number;
  /** Margine minimo osservato tra t0 del tick e il clock, secondi (negativo = in ritardo). */
  minMargin: number;
}

export class Scheduler {
  readonly tickDuration: number;
  readonly lookahead: number;
  private readonly wakeInterval: number;
  private readonly startDelay: number;
  private readonly maxLateness: number;
  private origin = 0;
  private k = 0;
  private running = false;
  readonly stats: SchedulerStats = { ticks: 0, dropouts: 0, minMargin: Infinity };
  /** Chiamato dopo ogni blocco di tick calcolati in un risveglio. */
  onPump?: (upTo: number) => void;

  constructor(
    private readonly target: TickTarget,
    private readonly clock: Clock,
    private readonly waker: Waker,
    opts: SchedulerOptions = {},
  ) {
    this.tickDuration = opts.tickDuration ?? 0.005;
    this.lookahead = opts.lookahead ?? 0.1;
    this.wakeInterval = opts.wakeInterval ?? 25;
    this.startDelay = opts.startDelay ?? 0.05;
    this.maxLateness = opts.maxLateness ?? 0.25;
    if (!(this.tickDuration > 0)) throw new Error('tickDuration > 0');
    if (!(this.lookahead >= this.tickDuration)) throw new Error('lookahead >= tickDuration');
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Inizio del prossimo tick da calcolare. */
  get nextTickTime(): number {
    return this.origin + this.k * this.tickDuration;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.origin = this.clock.now() + this.startDelay;
    this.k = 0;
    this.waker.start(this.wakeInterval, () => this.pump());
    this.pump();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.waker.stop();
  }

  /** Calcola i tick fino a now + lookahead. Pubblico per i test. */
  pump(): void {
    if (!this.running) return;
    const now = this.clock.now();
    if (now - this.nextTickTime > this.maxLateness) {
      // Riparte da "adesso": il grafo integra dt, quindi la fase non salta,
      // la musica si ferma per il tempo perso invece di recuperarlo a raffica.
      this.origin = now + this.startDelay;
      this.k = 0;
      this.stats.dropouts++;
    }
    const horizon = now + this.lookahead;
    while (this.running && this.nextTickTime < horizon) {
      const t0 = this.nextTickTime;
      const t1 = this.origin + (this.k + 1) * this.tickDuration;
      this.stats.minMargin = Math.min(this.stats.minMargin, t0 - now);
      this.target.process(t0, t1);
      this.k++;
      this.stats.ticks++;
    }
    this.onPump?.(this.nextTickTime);
  }
}

// ─── Implementazioni per il browser ────────────────────────────────────────

export function audioContextClock(ctx: BaseAudioContext): Clock {
  return { now: () => ctx.currentTime };
}

/**
 * Waker in un Web Worker: i timer dei worker non vengono rallentati quando la
 * tab è in background, a differenza di quelli del main thread.
 */
export class WorkerWaker implements Waker {
  private worker: Worker | null = null;

  start(intervalMs: number, wake: () => void): void {
    this.stop();
    this.worker = new Worker(new URL('./timerWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => wake();
    this.worker.postMessage({ interval: intervalMs });
  }

  stop(): void {
    this.worker?.postMessage({ interval: 0 });
    this.worker?.terminate();
    this.worker = null;
  }
}
