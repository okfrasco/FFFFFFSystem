import { describe, expect, it } from 'vitest';
import { SR, audioSim, brightness, rms } from '../../../../tests/helpers/audio';

const run = (params: Record<string, number>, seconds = 1) =>
  audioSim([{ id: 'n', module: 'audioNoise', params }], [], ['n.out']).run(seconds).get('n.out')!;

describe('Noise (audio)', () => {
  it('bianco, rosa, marrone: sempre più scuri', () => {
    const b = [0, 1, 2].map((color) => brightness(run({ color, level: 0.5 })[0]!));
    expect(b[0]).toBeGreaterThan(1.2);
    expect(b[1]!).toBeLessThan(b[0]! * 0.6);
    expect(b[2]!).toBeLessThan(b[1]! * 0.6);
  });

  it('livelli comparabili', () => {
    for (const color of [0, 1, 2]) {
      const r = rms(run({ color, level: 0.5 })[0]!);
      expect(r, `colore ${color}`).toBeGreaterThan(0.05);
      expect(r).toBeLessThan(0.5);
    }
  });

  it('crackle: circa density impulsi al secondo', () => {
    const x = run({ color: 3, density: 300 }, 2)[0]!;
    const hits = x.filter((s) => s !== 0).length;
    expect(hits).toBeGreaterThan(500);
    expect(hits).toBeLessThan(700);
    expect(x.length).toBe(Math.ceil((2 * SR) / 128) * 128);
  });

  it('stereo: due voci diverse', () => {
    const [l, r] = run({ stereo: 1 }, 0.1);
    expect(r).toBeDefined();
    expect(l).not.toEqual(r);
  });
});
