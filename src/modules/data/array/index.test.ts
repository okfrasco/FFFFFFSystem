import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import type { ArrayState } from './index';

describe('Array', () => {
  it('registra i valori degli eventi nelle celle in cui cadono, poi li rilegge', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'p', module: 'pitches', config: { notes: [60, 62, 64, 67] } },
        { id: 'a', module: 'array', params: { size: 4, record: 1 } },
      ],
      [
        { from: 'tr.bar', to: 'p.phase' },
        { from: 'tr.bar', to: 'a.phase' },
        { from: 'p.note', to: 'a.in' },
      ],
      ['a.trig'],
    );
    sim.runTo(1);
    expect((sim.graph.node('a').instance.getState() as ArrayState).table).toEqual([60, 62, 64, 67]);
    // senza registrare: la battuta dopo rilegge la tabella
    sim.graph.node('a').params.setBase('record', 0);
    sim.runTo(2);
    expect(sim.events('a.trig').slice(4).map((e) => (e.kind === 'trig' ? e.value : -1))).toEqual([60, 62, 64, 67]);
  });

  it('registra un valore continuo solo mentre rec è alto', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events: [], levels: [[0, 0.3], [1, 0.9]] } },
        { id: 'rec', module: 'script', config: { events: [], levels: [[0, 1], [0.99, 0]] } },
        { id: 'a', module: 'array', params: { size: 4 } },
      ],
      [
        { from: 'tr.bar', to: 'a.phase' },
        { from: 'src.out', to: 'a.in' },
        { from: 'rec.out', to: 'a.rec' },
      ],
      [],
    );
    sim.runTo(1);
    // celle 0 e 1 (primo secondo) registrate a 0.3, poi rec si spegne
    const t = (sim.graph.node('a').instance.getState() as ArrayState).table;
    expect(t.map((x) => Math.round(x * 10) / 10)).toEqual([0.3, 0.3, 0, 0]);
  });
});
