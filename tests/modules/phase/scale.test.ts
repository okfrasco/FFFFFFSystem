import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../helpers/sim';

describe('Ø Scale', () => {
  it('moltiplica la fase per num/den, senza deriva', () => {
    for (const [num, den] of [[2, 1], [3, 4], [1, 3]] as const) {
      const sim = simulate(
        [TRANSPORT, { id: 'sc', module: 'phaseScale', params: { num, den } }],
        [{ from: 'tr.bar', to: 'sc.in' }],
        ['tr.bar', 'sc.out'],
      );
      sim.runTo(20);
      const inp = sim.phases('tr.bar');
      const out = sim.phases('sc.out');
      for (let i = 0; i < out.length; i += 97) expect(out[i]!.end[0]).toBeCloseTo((inp[i]!.end[0]! * num) / den, 9);
    }
  });

  it('il rapporto cambia alla battuta successiva, ripartendo dall\'intero più vicino', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'sc', module: 'phaseScale', params: { num: 3, den: 4 } }],
      [{ from: 'tr.bar', to: 'sc.in' }],
      ['tr.bar', 'sc.out'],
    );
    sim.runTo(1.5);
    sim.graph.setParam('sc', 'num', 1);
    sim.graph.setParam('sc', 'den', 1);
    sim.runTo(4);
    const inp = sim.phases('tr.bar');
    const out = sim.phases('sc.out');
    let jumps = 0;
    for (let i = 1; i < out.length; i++) {
      const inBar = inp[i]!.end[0]!;
      if (inBar < 2 - 1e-9) expect(out[i]!.end[0]).toBeCloseTo(inBar * 0.75, 9);
      if (inp[i]!.start[0]! >= 2) expect(out[i]!.end[0]).toBeCloseTo(inBar - 2 + 2, 9); // round(1.5)=2
      if (Math.abs(out[i]!.start[0]! - out[i - 1]!.end[0]!) > 1e-9) jumps++;
    }
    expect(jumps).toBe(1); // un solo salto, tra due tick, alla battuta 2
  });

  it('senza cambio di rapporto la fase è continua tick per tick', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'sc', module: 'phaseScale', params: { num: 5, den: 3 } }],
      [{ from: 'tr.bar', to: 'sc.in' }],
      ['sc.out'],
    );
    sim.runTo(10);
    const out = sim.phases('sc.out');
    for (let i = 1; i < out.length; i++) expect(out[i]!.start[0]).toBe(out[i - 1]!.end[0]);
  });
});
