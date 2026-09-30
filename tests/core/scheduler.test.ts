import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { Scheduler, type Clock, type Waker } from '../../src/core/scheduler';

class FakeClock implements Clock {
  t = 10;
  now(): number {
    return this.t;
  }
}

class ManualWaker implements Waker {
  wake: (() => void) | null = null;
  interval = 0;
  start(intervalMs: number, wake: () => void): void {
    this.interval = intervalMs;
    this.wake = wake;
  }
  stop(): void {
    this.wake = null;
  }
}

function setup(opts = {}) {
  const clock = new FakeClock();
  const waker = new ManualWaker();
  const ticks: [number, number][] = [];
  const s = new Scheduler({ process: (t0, t1) => ticks.push([t0, t1]) }, clock, waker, opts);
  return { clock, waker, ticks, s };
}

function expectContiguous(ticks: [number, number][], dur: number): void {
  for (let i = 0; i < ticks.length; i++) {
    const [t0, t1] = ticks[i]!;
    expect(t1 - t0).toBeCloseTo(dur, 9);
    if (i > 0) expect(t0).toBe(ticks[i - 1]![1]);
  }
}

describe('Scheduler', () => {
  it('allo start calcola i tick fino a now + lookahead, partendo dopo startDelay', () => {
    const { s, ticks, waker } = setup();
    s.start();
    expect(waker.interval).toBe(25);
    expect(ticks[0]![0]).toBeCloseTo(10.05, 12);
    // da 10.05 a < 10.1: 10 tick da 5 ms
    expect(ticks).toHaveLength(10);
    expect(s.nextTickTime).toBeGreaterThanOrEqual(10.1 - 1e-12);
  });

  it('con risvegli irregolari i tick restano contigui, senza buchi né doppioni', () => {
    const { s, ticks, clock, waker } = setup();
    const rng = new Rng(1);
    s.start();
    for (let i = 0; i < 1000; i++) {
      clock.t += rng.range(0.001, 0.06); // jitter pesante del waker
      waker.wake!();
      // il tick in calcolo è sempre nel futuro rispetto al clock
      expect(ticks[ticks.length - 1]![1]).toBeGreaterThan(clock.t);
    }
    expectContiguous(ticks, 0.005);
    expect(s.stats.dropouts).toBe(0);
    expect(s.stats.minMargin).toBeGreaterThan(0);
    // copertura fino all'orizzonte
    expect(s.nextTickTime).toBeGreaterThanOrEqual(clock.t + 0.1 - 1e-9);
  });

  it('i tempi dei tick non accumulano errore', () => {
    const { s, ticks, clock, waker } = setup();
    s.start();
    for (let i = 0; i < 40_000; i++) {
      clock.t += 0.025;
      waker.wake!();
    }
    const k = ticks.length - 1;
    expect(ticks[k]![0]).toBe(10.05 + k * 0.005);
  });

  it('se resta indietro troppo salta in avanti invece di recuperare a raffica', () => {
    const { s, ticks, clock, waker } = setup();
    s.start();
    const before = ticks.length;
    clock.t += 5; // tab congelata per 5 s
    waker.wake!();
    expect(s.stats.dropouts).toBe(1);
    expect(ticks.length - before).toBe(10); // solo il lookahead, non 1000 tick
    expect(ticks[before]![0]).toBeCloseTo(clock.t + 0.05, 9);
  });

  it('stop ferma i risvegli e i tick', () => {
    const { s, ticks, clock, waker } = setup();
    s.start();
    s.stop();
    expect(waker.wake).toBeNull();
    const n = ticks.length;
    clock.t += 1;
    s.pump();
    expect(ticks).toHaveLength(n);
    expect(s.isRunning).toBe(false);
  });

  it('rifiuta opzioni incoerenti', () => {
    const c = new FakeClock();
    const w = new ManualWaker();
    const target = { process: () => {} };
    expect(() => new Scheduler(target, c, w, { tickDuration: 0 })).toThrow();
    expect(() => new Scheduler(target, c, w, { tickDuration: 0.01, lookahead: 0.005 })).toThrow();
  });
});
