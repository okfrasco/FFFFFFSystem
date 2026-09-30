import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';
import { pcsOfMask } from '../theory';
import { susChord } from './index';

describe('susChord', () => {
  it('Csus sul basso più scuro (La♭), il sus sopra', () => {
    expect(susChord(0, 0, 3, 0, 0, 36).chord).toEqual([44, 60, 65, 67]);
  });

  it('Csus♭5: bassi della lidia di Do, dal Do al Fa♯', () => {
    expect(susChord(0, 1, 3, 0, 0, 36).chord).toEqual([36, 48, 53, 54]);
    const bright = susChord(0, 1, 3, 0.99, 0, 36);
    expect(bright.chord).toEqual([42, 60, 65, 66]);
    expect(bright.scale).toEqual([0, 2, 4, 5, 6, 7, 9, 11]);
  });

  it('quintale a 5 note: quinte sovrapposte', () => {
    const r = susChord(0, 7, 5, 0.5, 0, 36);
    expect(r.chord.slice(1).map((p, i, a) => (i ? p - a[i - 1]! : 0))).toEqual([0, 7, 7, 7, 7]);
  });
});

describe('Sus Slash', () => {
  it('esce accordo, scala e basso; un change quando il basso cambia', () => {
    const sim = simulate([{ id: 's', module: 'susSlash', params: { root: 0, variant: 1, bass: 0 } }], [], ['s.chord', 's.scale', 's.bass', 's.change']);
    sim.runTo(0.25);
    sim.graph.node('s').params.setBase('bass', 0.99);
    sim.runTo(0.5);
    expect(sim.values('s.chord').at(-1)).toEqual([42, 60, 65, 66]);
    expect(pcsOfMask(sim.values('s.scale').at(-1)!)).toEqual([0, 2, 4, 5, 6, 7, 9, 11]);
    expect(sim.events('s.change').map((e) => (e.kind === 'trig' ? e.value : -1))).toEqual([0, 6]);
  });
});
