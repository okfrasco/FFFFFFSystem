import { describe, expect, it } from 'vitest';
import { bjorklund } from '../../../src/modules/generators/euclid';
import { TRANSPORT, compact, simulate, stepOf, vel } from '../../helpers/sim';

const str = (p: boolean[]) => p.map((x) => (x ? 'x' : '.')).join('');

describe('bjorklund', () => {
  it('dà i pattern canonici di Toussaint', () => {
    expect(str(bjorklund(3, 8))).toBe('x..x..x.');
    expect(str(bjorklund(5, 8))).toBe('x.xx.xx.');
    expect(str(bjorklund(2, 5))).toBe('x.x..');
    expect(str(bjorklund(4, 16))).toBe('x...x...x...x...');
    expect(str(bjorklund(5, 16))).toBe('x..x..x..x..x...');
    expect(str(bjorklund(0, 4))).toBe('....');
    expect(str(bjorklund(6, 4))).toBe('xxxx');
  });

  it('ha sempre K impulsi distribuiti al massimo (distanze che differiscono al più di 1)', () => {
    for (let n = 1; n <= 32; n++) {
      for (let k = 0; k <= n; k++) {
        const p = bjorklund(k, n);
        expect(p).toHaveLength(n);
        expect(p.filter(Boolean)).toHaveLength(k);
        if (k >= 2) {
          const idx = p.flatMap((x, i) => (x ? [i] : []));
          const gaps = idx.map((x, i) => (idx[(i + 1) % k]! - x + n) % n || n);
          expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('Euclideo nel grafo', () => {
  const run = (params: Record<string, number>, bars = 2, seed = 1) => {
    const sim = simulate(
      [TRANSPORT, { id: 'eu', module: 'euclid', params }],
      [{ from: 'tr.bar', to: 'eu.phase' }],
      ['eu.trig', 'eu.gate'],
      seed,
    );
    sim.runTo(bars);
    return sim;
  };

  it('E(4,16) cade esattamente sui quarti', () => {
    const ev = run({ steps: 16, pulses: 4 }).events('eu.trig');
    expect(ev.map((e) => stepOf(e.t))).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(ev.every((e) => vel(e) === 1)).toBe(true);
  });

  it('la rotazione sposta il pattern', () => {
    const ev = run({ steps: 8, pulses: 3, rotate: 1 }, 1).events('eu.trig');
    // x..x..x. ruotato di 1 → .x..x..x
    expect(ev.map((e) => stepOf(e.t, 8))).toEqual([1, 4, 7]);
  });

  it('lo swing sposta gli step dispari', () => {
    const ev = run({ steps: 8, pulses: 8, swing: 2 / 3 }, 1).events('eu.trig');
    expect(ev.map((e) => stepOf(e.t, 8))).toEqual([0, 1.333333, 2, 3.333333, 4, 5.333333, 6, 7.333333]);
  });

  it('su una fase poly ogni voce suona il proprio pattern sfasato', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'sp', module: 'phaseSplit', params: { count: 2, spread: 0.25 } }, { id: 'eu', module: 'euclid', params: { steps: 4, pulses: 1 } }],
      [{ from: 'tr.bar', to: 'sp.in' }, { from: 'sp.out', to: 'eu.phase' }],
      ['eu.trig'],
    );
    sim.runTo(2);
    const byVoice = [0, 1].map((v) => sim.events('eu.trig').filter((e) => e.voice === v).map((e) => stepOf(e.t, 8)));
    expect(byVoice[0]).toEqual([0, 8]);
    expect(byVoice[1]).toEqual([1, 9]);
  });

  it('mutazione: stessa seed stessi colpi, seed diverso colpi diversi, ghost a 0.5', () => {
    const a = run({ steps: 16, pulses: 5, mutation: 0.4 }, 16, 7).events('eu.trig');
    const b = run({ steps: 16, pulses: 5, mutation: 0.4 }, 16, 7).events('eu.trig');
    const c = run({ steps: 16, pulses: 5, mutation: 0.4 }, 16, 8).events('eu.trig');
    expect(compact(a)).toEqual(compact(b));
    expect(compact(a)).not.toEqual(compact(c));
    expect(a.some((e) => vel(e) === 0.5)).toBe(true);
    // senza mutazione ogni battuta è uguale
    const plain = run({ steps: 16, pulses: 5 }, 4).events('eu.trig');
    expect(plain).toHaveLength(20);
    expect(compact(a).slice(0, 24)).toMatchSnapshot();
  });

  it('il gate resta alto per tutto lo step acceso', () => {
    const sim = run({ steps: 4, pulses: 2 }, 1);
    const gate = sim.values('eu.gate').map((v) => v[0]);
    // x.x. : alto nel primo quarto, basso nel secondo
    expect(gate[50]).toBe(1);
    expect(gate[150]).toBe(0);
    expect(gate[250]).toBe(1);
  });
});
