import { describe, expect, it } from 'vitest';
import { EventQueue } from '../../src/core/eventQueue';
import type { ControlEvent } from '../../src/core/types';

const trig = (t: number): ControlEvent => ({ kind: 'trig', t, voice: 0, vel: 1 });

describe('EventQueue', () => {
  it('consegna ogni evento nel tick che lo contiene, in ordine', () => {
    const q = new EventQueue();
    [0.3, 0.012, 0.007].forEach((t) => q.push(trig(t)));
    const a: ControlEvent[] = [];
    q.flush(0, 0.01, a);
    expect(a.map((e) => e.t)).toEqual([0.007]);
    const b: ControlEvent[] = [];
    q.flush(0.01, 0.02, b);
    expect(b.map((e) => e.t)).toEqual([0.012]);
    expect(q.size).toBe(1);
  });

  it('un evento già passato esce all\'inizio del tick; lo stato si salva e riprende', () => {
    const q = new EventQueue();
    q.push(trig(0.5));
    q.push(trig(0.9));
    const saved = JSON.parse(JSON.stringify(q.getState()));
    const out: ControlEvent[] = [];
    q.flush(0.6, 0.7, out);
    expect(out.map((e) => e.t)).toEqual([0.6]);
    const r = new EventQueue();
    r.setState(saved);
    expect(r.size).toBe(2);
  });
});
