import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { perlin1 } from './index';

describe('perlin1', () => {
  it('liscio, limitato, zero agli interi (una ottava), riproducibile', () => {
    let prev = perlin1(3, 0);
    for (let i = 1; i < 3000; i++) {
      const y = perlin1(3, i / 300, 3);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
      prev = y;
    }
    expect(prev).toBe(perlin1(3, 2999 / 300, 3));
    expect(perlin1(3, 5, 1)).toBeCloseTo(0, 9);
  });
});

describe('Noise', () => {
  const run = (kind: number, rate = 8) => {
    const sim = simulate([TRANSPORT, { id: 'n', module: 'noise', params: { kind, rate } }], [], ['n.out']);
    sim.runTo(8);
    return sim.values('n.out').map((v) => v[0]!);
  };
  const roughness = (x: number[]) => x.slice(1).reduce((s, y, i) => s + Math.abs(y - x[i]!), 0) / (x.length - 1);

  it('tutti i tipi restano tra 0 e 1', () => {
    for (const k of [0, 1, 2, 3]) for (const y of run(k)) expect(y >= 0 && y <= 1).toBe(true);
  });

  it('il marrone è più lento del bianco, il rosa sta in mezzo', () => {
    const white = roughness(run(1));
    const pink = roughness(run(2));
    const brown = roughness(run(3));
    expect(brown).toBeLessThan(pink);
    expect(pink).toBeLessThan(white);
  });

  it('con la fase collegata è a tempo: più BPM, più variazioni', () => {
    const at = (bpm: number) => {
      const sim = simulate([{ id: 'tr', module: 'transport', params: { bpm } }, { id: 'n', module: 'noise', params: { kind: 1, rate: 8 } }], [{ from: 'tr.bar', to: 'n.phase' }], ['n.out']);
      sim.runTo(4);
      return roughness(sim.values('n.out').map((v) => v[0]!));
    };
    expect(at(180)).toBeGreaterThan(at(60));
  });
});
