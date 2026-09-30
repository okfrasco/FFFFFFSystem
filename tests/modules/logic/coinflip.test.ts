import { describe, expect, it } from 'vitest';
import type { ControlEvent } from '../../../src/core/types';
import { TRANSPORT, compact, simulate } from '../../helpers/sim';

const hits = (n: number): ControlEvent[] => Array.from({ length: n }, (_, i) => ({ kind: 'trig', t: i * 0.01 + 0.001, voice: 0, vel: 1 }));

function run(prob: number, events: ControlEvent[], seed = 1) {
  const sim = simulate(
    [TRANSPORT, { id: 'src', module: 'script', config: { events } }, { id: 'cf', module: 'coinFlip', params: { prob } }],
    [{ from: 'src.out', to: 'cf.trig' }],
    ['cf.a', 'cf.b'],
    seed,
  );
  sim.runTo(Math.ceil((events.at(-1)!.t + 0.1) / 2));
  return { a: sim.events('cf.a'), b: sim.events('cf.b') };
}

describe('Coin Flip', () => {
  it('prob 1 → tutto su A, prob 0 → tutto su B', () => {
    expect(run(1, hits(50)).a).toHaveLength(50);
    expect(run(0, hits(50)).b).toHaveLength(50);
  });

  it('prob 0.3 → circa il 30% su A, senza perdere né duplicare colpi', () => {
    const { a, b } = run(0.3, hits(2000));
    expect(a.length + b.length).toBe(2000);
    expect(a.length / 2000).toBeGreaterThan(0.26);
    expect(a.length / 2000).toBeLessThan(0.34);
  });

  it('la chiusura di un gate segue la sua apertura', () => {
    const ev: ControlEvent[] = [];
    for (let i = 0; i < 40; i++) {
      ev.push({ kind: 'gate', t: i * 0.02, voice: 0, on: true });
      ev.push({ kind: 'gate', t: i * 0.02 + 0.01, voice: 0, on: false });
    }
    const { a, b } = run(0.5, ev);
    for (const side of [a, b]) {
      side.forEach((e, i) => expect((e as { on: boolean }).on).toBe(i % 2 === 0));
    }
  });

  it('riproducibile a seed fisso', () => {
    const x = run(0.5, hits(64), 9);
    expect(compact(x.a)).toEqual(compact(run(0.5, hits(64), 9).a));
    expect(compact(x.a)).toMatchSnapshot();
  });
});
