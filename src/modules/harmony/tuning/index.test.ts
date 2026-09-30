import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';
import { PRESETS, parseScala, tune } from './scala';

describe('Scala', () => {
  it('legge cents e rapporti', () => {
    const t = parseScala('! commento\nprova\n 3\n!\n 100.0\n 3/2 quinta\n 2\n');
    expect(t.name).toBe('prova');
    expect(t.cents.map((c) => Math.round(c * 100) / 100)).toEqual([100, 701.96, 1200]);
  });

  it('rifiuta un file incompleto', () => {
    expect(() => parseScala('x\n4\n100.0\n')).toThrow();
  });
});

describe('tune', () => {
  it('12-TET non cambia niente; la giusta abbassa la terza di ~14 cents', () => {
    expect(tune(64, 60, PRESETS[0]!)).toBeCloseTo(64, 9);
    expect(tune(64, 60, PRESETS[1]!)).toBeCloseTo(63.8631, 3);
    expect(tune(72, 60, PRESETS[1]!)).toBeCloseTo(72, 9);
    expect(tune(59, 60, PRESETS[1]!)).toBeCloseTo(58.8827, 3); // 15/8 un'ottava sotto
  });

  it('19-TET: 19 tasti fanno un ottava', () => {
    expect(tune(79, 60, PRESETS[4]!)).toBeCloseTo(72, 9);
  });
});

describe('Tuning', () => {
  it('le note escono con altezze frazionarie', () => {
    const sim = simulate(
      [
        { id: 's', module: 'script', config: { events: [{ kind: 'note', t: 0.1, voice: 0, pitch: 67, vel: 1, dur: 0.2 }] } },
        { id: 'u', module: 'tuning', params: { preset: 1, base: 60 } },
      ],
      [{ from: 's.out', to: 'u.note' }],
      ['u.note'],
    );
    sim.runTo(0.25);
    const e = sim.events('u.note')[0]!;
    expect(e.kind === 'note' && e.pitch).toBeCloseTo(67.0196, 3);
  });
});
