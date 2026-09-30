import { describe, expect, it } from 'vitest';
import { SCALES, degreeToPitch, nearestInScale } from './index';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

const major = SCALES[0]!.steps;
const pentMin = SCALES.find((s) => s.name === 'pentatonica minore')!.steps;

describe('funzioni di scala', () => {
  it('nearestInScale: nota più vicina, a parità quella sotto', () => {
    expect(nearestInScale(61, 0, major)).toBe(60);
    expect(nearestInScale(66, 0, major)).toBe(65);
    expect(nearestInScale(64.4, 0, major)).toBe(64);
    expect(nearestInScale(63, 2, major)).toBe(62); // D maggiore: D# → D (tra D e E, sotto)
    expect(nearestInScale(58, 9, pentMin)).toBe(57); // A pent. minore: A C D E G
  });

  it('degreeToPitch: gradi, ottave e negativi', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((d) => degreeToPitch(d, 48, 0, major))).toEqual([48, 50, 52, 53, 55, 57, 59, 60]);
    expect(degreeToPitch(-1, 48, 0, major)).toBe(47);
    expect(degreeToPitch(-7, 48, 0, major)).toBe(36);
    expect(degreeToPitch(5, 48, 9, pentMin)).toBe(69);
  });
});

describe('Quantize nel grafo', () => {
  it('gradi da Steps → note in scala, con la durata del parametro', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 's', module: 'steps', config: { values: [0, 1, 2, 3, 4, 5, 6, 7] } },
        { id: 'q', module: 'quantize', params: { root: 2, scale: 0, mode: 1, base: 48, length: 0.1 } },
      ],
      [
        { from: 'tr.bar', to: 's.phase' },
        { from: 's.trig', to: 'q.trig' },
      ],
      ['q.note'],
    );
    sim.runTo(1);
    const notes = sim.events('q.note') as { pitch: number; dur: number }[];
    expect(notes.map((n) => n.pitch)).toEqual([50, 52, 54, 55, 57, 59, 61, 62]); // D maggiore
    expect(notes.every((n) => Math.abs(n.dur - 0.1) < 1e-9)).toBe(true);
  });

  it('modo range: 0–1 copre range semitoni sopra base', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 's', module: 'steps', config: { values: [0, 0.5, 0.52, 1] } },
        { id: 'q', module: 'quantize', params: { mode: 0, base: 48, range: 24 } },
      ],
      [
        { from: 'tr.bar', to: 's.phase' },
        { from: 's.trig', to: 'q.trig' },
      ],
      ['q.note'],
    );
    sim.runTo(1);
    // 48, 60, 60.48 → 60, 72
    expect(sim.events('q.note').map((n) => (n as { pitch: number }).pitch)).toEqual([48, 60, 60, 72]);
  });

  it('le note in ingresso vengono portate sulla scala e tengono la durata', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events: [{ kind: 'note', t: 0.1, voice: 0, pitch: 61, vel: 0.7, dur: 0.33 }] } },
        { id: 'q', module: 'quantize', params: { scale: 0 } },
      ],
      [{ from: 'src.out', to: 'q.trig' }],
      ['q.note'],
    );
    sim.runTo(1);
    expect(sim.events('q.note')).toEqual([{ kind: 'note', t: 0.1, voice: 0, pitch: 60, vel: 0.7, dur: 0.33 }]);
  });
});

describe('Quantize sul campo', () => {
  it('prende la scala dal Campo armonico (pentatonica minore) in modo grado', () => {
    const sim = simulate(
      [
        { id: 'f', module: 'harmonicField', params: { root: 0, scale: 10 } },
        { id: 's', module: 'script', config: { events: [0.1, 0.2, 0.3].map((t, i) => ({ kind: 'trig', t, voice: 0, vel: 1, value: [1, 2, 5][i] })) } },
        { id: 'q', module: 'quantize', params: { mode: 1, base: 48 } },
      ],
      [
        { from: 'f.scale', to: 'q.scale' },
        { from: 's.out', to: 'q.trig' },
      ],
      ['q.note'],
    );
    sim.runTo(0.25);
    expect(sim.events('q.note').map((e) => (e.kind === 'note' ? e.pitch : 0))).toEqual([51, 53, 60]);
  });
});
