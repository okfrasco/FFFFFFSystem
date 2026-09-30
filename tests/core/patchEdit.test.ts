import { describe, expect, it } from 'vitest';
import { Graph } from '../../src/core/graph';
import {
  addNode,
  autoLayout,
  connect,
  connectionError,
  disconnect,
  emptyPatch,
  moveNode,
  removeNode,
  setAmount,
  setParam,
  uniqueId,
} from '../../src/core/patchEdit';
import type { Patch } from '../../src/core/types';
import { testRegistry as reg } from '../helpers/sim';

function build(): Patch {
  let p = emptyPatch();
  for (const m of ['transport', 'euclid', 'markov', 'quantize', 'phaseSplit']) p = addNode(p, reg, m).patch;
  return p;
}

describe('patchEdit', () => {
  it('id unici per modulo e patch immutabile', () => {
    const p0 = emptyPatch();
    const a = addNode(p0, reg, 'euclid', { x: 1, y: 2 });
    const b = addNode(a.patch, reg, 'euclid');
    expect([a.id, b.id]).toEqual(['euclid1', 'euclid2']);
    expect(p0.nodes).toHaveLength(0);
    expect(a.patch.nodes[0]!.ui).toEqual({ x: 1, y: 2 });
    expect(uniqueId(b.patch, 'markov')).toBe('markov1');
    expect(() => addNode(p0, reg, 'nope')).toThrow();
  });

  it('valida le connessioni con i soli manifest', () => {
    const p = build();
    const err = (from: string, to: string) => connectionError(p, reg, { from, to });
    expect(err('transport1.bar', 'euclid1.phase')).toBeNull();
    expect(err('euclid1.trig', 'markov1.trig')).toBeNull();
    expect(err('euclid1.gate', 'markov1.param:m0_1')).toBeNull();
    expect(err('transport1.bar', 'markov1.param:m0_1')).toMatch(/controllo/);
    expect(err('euclid1.trig', 'euclid1.phase')).toMatch(/tipo/);
    expect(err('euclid1.gate', 'markov1.trig')).toMatch(/segnale/);
    expect(err('euclid1.phase', 'markov1.trig')).toMatch(/non è un'uscita/);
    expect(err('euclid1.trig', 'markov1.nope')).toMatch(/non è un ingresso/);
    expect(err('euclid1.trig', 'markov1.param:nope')).toMatch(/parametro/);
    const once = connect(p, reg, { from: 'transport1.bar', to: 'euclid1.phase' });
    expect(connectionError(once, reg, { from: 'transport1.bar', to: 'euclid1.phase' })).toMatch(/già/);
    expect(connectionError(once, reg, { from: 'phaseSplit1.out', to: 'euclid1.phase' })).toMatch(/una sola/);
  });

  it('connect dà un amount di default alle modulazioni, disconnect e setAmount', () => {
    let p = connect(build(), reg, { from: 'euclid1.gate', to: 'markov1.param:m0_1' });
    expect(p.connections[0]!.amount).toBe(0.5);
    p = setAmount(p, 'euclid1.gate', 'markov1.param:m0_1', -0.2);
    expect(p.connections[0]!.amount).toBe(-0.2);
    p = disconnect(p, 'euclid1.gate', 'markov1.param:m0_1');
    expect(p.connections).toHaveLength(0);
    expect(() => connect(p, reg, { from: 'x.y', to: 'euclid1.phase' })).toThrow();
  });

  it('removeNode toglie anche i suoi cavi; le altre modifiche toccano solo il nodo indicato', () => {
    let p = connect(build(), reg, { from: 'transport1.bar', to: 'euclid1.phase' });
    p = connect(p, reg, { from: 'euclid1.trig', to: 'markov1.trig' });
    p = removeNode(p, 'euclid1');
    expect(p.connections).toHaveLength(0);
    p = setParam(moveNode(p, 'markov1', { x: 5, y: 6 }), 'markov1', 'size', 4);
    const mk = p.nodes.find((n) => n.id === 'markov1')!;
    expect(mk.ui).toEqual({ x: 5, y: 6 });
    expect(mk.params).toEqual({ size: 4 });
  });

  it('ogni patch prodotta dalle modifiche si costruisce', () => {
    let p = build();
    p = connect(p, reg, { from: 'transport1.bar', to: 'euclid1.phase' });
    p = connect(p, reg, { from: 'euclid1.trig', to: 'markov1.trig' });
    p = connect(p, reg, { from: 'markov1.trig', to: 'quantize1.trig' });
    p = connect(p, reg, { from: 'euclid1.gate', to: 'markov1.param:a3' });
    expect(() => Graph.build(p, reg)).not.toThrow();
  });

  it('autoLayout mette le sorgenti a sinistra e non tocca le posizioni esistenti', () => {
    let p = connect(build(), reg, { from: 'transport1.bar', to: 'euclid1.phase' });
    p = connect(p, reg, { from: 'euclid1.trig', to: 'markov1.trig' });
    p = moveNode(p, 'quantize1', { x: 999, y: 999 });
    const l = autoLayout(p, reg);
    const x = (id: string) => l.nodes.find((n) => n.id === id)!.ui!.x;
    expect(x('transport1')).toBeLessThan(x('euclid1'));
    expect(x('euclid1')).toBeLessThan(x('markov1'));
    expect(x('quantize1')).toBe(999);
  });
});
