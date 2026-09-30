import { beforeEach, describe, expect, it } from 'vitest';
import { Graph, GraphError, parseEndpoint, signalCompatible } from '../../src/core/graph';
import { hash32, hashString } from '../../src/core/rng';
import type { ControlBuffer, Patch, PatchConnection, PatchNode } from '../../src/core/types';
import { fakeRegistry, processLog } from '../helpers/fakeModules';

const patch = (nodes: PatchNode[], connections: PatchConnection[] = [], seed = 1): Patch => ({
  version: 1,
  seed,
  nodes,
  connections,
});

const build = (p: Patch) => Graph.build(p, fakeRegistry);

function buildErrors(p: Patch): string[] {
  try {
    build(p);
  } catch (e) {
    if (e instanceof GraphError) return e.errors;
    throw e;
  }
  return [];
}

const ctl = (g: Graph, node: string, port: string) => g.output(node, port) as ControlBuffer;

beforeEach(() => {
  processLog.length = 0;
});

describe('parseEndpoint', () => {
  it('riconosce porte e parametri', () => {
    expect(parseEndpoint('lfo.out')).toEqual({ node: 'lfo', port: 'out' });
    expect(parseEndpoint('eu.param:rotate')).toEqual({ node: 'eu', param: 'rotate' });
    for (const bad of ['', 'x', '.out', 'x.', 'x.param:', 'x.a.b', 'x.a:b']) expect(parseEndpoint(bad)).toBeNull();
  });
});

describe('signalCompatible', () => {
  it('value legge tutto, gate/event vogliono eventi', () => {
    expect(signalCompatible('gate', 'value')).toBe(true);
    expect(signalCompatible('event', 'gate')).toBe(true);
    expect(signalCompatible('value', 'gate')).toBe(false);
    expect(signalCompatible('value', 'event')).toBe(false);
  });
});

describe('Graph: ordine', () => {
  it('processa le sorgenti prima dei consumatori, qualunque sia l\'ordine della patch', () => {
    const g = build(
      patch(
        [
          { id: 'c', module: 'inc', config: { name: 'c' } },
          { id: 'b', module: 'inc', config: { name: 'b' } },
          { id: 'a', module: 'inc', config: { name: 'a' } },
        ],
        [
          { from: 'b.out', to: 'c.in' },
          { from: 'a.out', to: 'b.in' },
        ],
      ),
    );
    expect(g.order.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    g.process(0, 0.005);
    expect(processLog).toEqual(['a', 'b', 'c']);
    expect(ctl(g, 'c', 'out').values[0]).toBe(3);
    expect(g.delayedEdges).toEqual([]);
  });

  it('un ciclo diventa un arco con 1 tick di ritardo', () => {
    const g = build(
      patch(
        [
          { id: 'a', module: 'inc', config: { name: 'a' } },
          { id: 'b', module: 'inc', config: { name: 'b' } },
        ],
        [
          { from: 'b.out', to: 'a.in' },
          { from: 'a.out', to: 'b.in' },
        ],
      ),
    );
    expect(g.delayedEdges).toEqual([{ from: 'a', to: 'b' }]);
    expect(g.order.map((n) => n.id)).toEqual(['b', 'a']);
    const seq: number[] = [];
    for (let k = 0; k < 3; k++) {
      g.process(k * 0.005, (k + 1) * 0.005);
      seq.push(ctl(g, 'a', 'out').values[0]!);
    }
    // b legge a del tick prima (0, 2, 4), a legge b dello stesso tick
    expect(seq).toEqual([2, 4, 6]);
  });

  it('un nodo collegato a se stesso legge il proprio tick precedente', () => {
    const g = build(patch([{ id: 'a', module: 'inc' }], [{ from: 'a.out', to: 'a.in' }]));
    expect(g.delayedEdges).toEqual([{ from: 'a', to: 'a' }]);
    for (let k = 0; k < 4; k++) g.process(k, k + 1);
    expect(ctl(g, 'a', 'out').values[0]).toBe(4);
  });

  it('i nodi a frame rate non girano nei tick di controllo', () => {
    const g = build(
      patch(
        [
          { id: 'k', module: 'constant' },
          { id: 'f', module: 'frameNode' },
        ],
        [{ from: 'k.out', to: 'f.in' }],
      ),
    );
    g.process(0, 1);
    expect(processLog).not.toContain('frame');
  });
});

describe('Graph: validazione', () => {
  it('raccoglie tutti gli errori in una volta', () => {
    const errs = buildErrors(
      patch(
        [
          { id: 'k', module: 'constant' },
          { id: 'k', module: 'constant' },
          { id: 'x', module: 'nope' },
          { id: 'a.b', module: 'inc' },
          { id: 'i', module: 'inc', params: { wrong: 1 } },
          { id: 't', module: 'ticker' },
          { id: 'g', module: 'gateSink' },
          { id: 'g2', module: 'gateSink' },
          { id: 'j', module: 'inc' },
        ],
        [
          { from: 'k.out', to: 'g.ph' }, // control → phase
          { from: 'k.out', to: 'g.g' }, // value → gate
          { from: 'g.ph', to: 'j.param:gain' }, // fase su un parametro
          { from: 'k.nope', to: 'j.in' },
          { from: 'k.out', to: 'j.nope' },
          { from: 'k.out', to: 'j.param:nope' },
          { from: 'k.out', to: 'j.in', amount: 0.5 }, // amount su una porta
          { from: 'g.ph', to: 'g2.ph' },
          { from: 'g2.ph', to: 'g2.ph' }, // seconda sorgente su un ingresso di fase
          { from: 'ghost.out', to: 'j.in' },
          { from: 'bad', to: 'j.in' },
          { from: 't.trig', to: 'g.g' },
          { from: 't.trig', to: 'g.g' }, // duplicata
        ],
      ),
    );
    const expected = [
      'nodo duplicato: k',
      'modulo sconosciuto nope',
      'id di nodo non valido',
      'parametro sconosciuto: wrong',
      'tipo control → phase',
      'segnale value → gate',
      'solo un segnale di controllo',
      'non ha l\'uscita nope',
      'non ha l\'ingresso nope',
      'non ha il parametro nope',
      'amount vale solo verso un parametro',
      'accetta una sola connessione',
      'nodo inesistente',
      'sorgente non valida',
      'connessione duplicata',
    ];
    for (const frag of expected) expect(errs.some((e) => e.includes(frag)), frag).toBe(true);
    expect(errs).toHaveLength(expected.length);
  });

  it('accetta trig → ingresso gate', () => {
    expect(buildErrors(patch([{ id: 't', module: 'ticker' }, { id: 'g', module: 'gateSink' }], [{ from: 't.trig', to: 'g.g' }]))).toEqual([]);
  });
});

describe('Graph: segnali', () => {
  it('gli eventi si svuotano a ogni tick, i valori restano', () => {
    const g = build(patch([{ id: 't', module: 'ticker', params: { offset: 0.5 } }]));
    g.process(1, 1.01);
    const out = ctl(g, 't', 'trig');
    expect(out.events).toHaveLength(1);
    expect(out.events[0]!.t).toBeCloseTo(1.005, 12);
    g.process(1.01, 1.02);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]!.t).toBeCloseTo(1.015, 12);
    expect(out.values[0]).toBe(1);
  });

  it('più sorgenti sullo stesso ingresso di controllo si sommano, eventi in ordine di tempo', () => {
    const g = build(
      patch(
        [
          { id: 'late', module: 'ticker', params: { offset: 0.8 } },
          { id: 'early', module: 'ticker', params: { offset: 0.2 } },
          { id: 'g', module: 'gateSink' },
        ],
        [
          { from: 'late.trig', to: 'g.g' },
          { from: 'early.trig', to: 'g.g' },
        ],
      ),
    );
    g.process(0, 1);
    expect(ctl(g, 'g', 'seen').events.map((e) => e.t)).toEqual([0.2, 0.8]);
  });

  it('uscite poly: il numero di voci segue il nodo, le porte mono lo rifiutano', () => {
    const g = build(patch([{ id: 'k', module: 'constant', params: { value: 0.5, voices: 3 } }]));
    g.process(0, 1);
    expect(Array.from(ctl(g, 'k', 'out').values)).toEqual([0.5, 1, 1.5]);
    const mono = build(patch([{ id: 'i', module: 'inc' }]));
    expect(() => mono.node('i').outputs.control('out', 2)).toThrow(/non poly/);
  });

  it('i tap registrano l\'uscita al tempo di fine tick', () => {
    const g = build(patch([{ id: 'a', module: 'inc' }], [{ from: 'a.out', to: 'a.in' }]));
    const tl = g.tap('a', 'out');
    for (let k = 0; k < 4; k++) g.process(k, k + 1);
    expect(tl.sample(1)).toBe(1);
    expect(tl.sample(2.5)).toBe(2.5);
    expect(tl.sample(4)).toBe(4);
  });
});

describe('Graph: parametri', () => {
  it('modulazione additiva nello spazio normalizzato, con amount', () => {
    const g = build(
      patch(
        [
          { id: 'k', module: 'constant', params: { value: 0.25 } },
          { id: 'i', module: 'inc', params: { gain: 0.5 } },
        ],
        [{ from: 'k.out', to: 'i.param:gain', amount: 0.5 }],
      ),
    );
    g.process(0, 1);
    expect(g.node('i').ctx.param('gain')).toBeCloseTo(0.625, 6);
    expect(g.getParam('i', 'gain')).toBeCloseTo(0.5, 6); // il base non cambia
  });

  it('una sorgente poly dà un valore diverso per voce', () => {
    const g = build(
      patch(
        [
          { id: 'k', module: 'constant', params: { value: 0.1, voices: 3 } },
          { id: 'i', module: 'inc', params: { gain: 0 } },
        ],
        [{ from: 'k.out', to: 'i.param:gain' }],
      ),
    );
    g.process(0, 1);
    const p = (v: number) => g.node('i').ctx.param('gain', v);
    expect([p(0), p(1), p(2), p(3)].map((x) => +x.toFixed(6))).toEqual([0.1, 0.2, 0.3, 0.1]);
  });

  it('setParam cambia il valore base', () => {
    const g = build(patch([{ id: 'i', module: 'inc' }]));
    g.setParam('i', 'gain', 0.9);
    expect(g.node('i').ctx.param('gain')).toBeCloseTo(0.9, 6);
  });
});

describe('Graph: seed e config', () => {
  it('il seed di default deriva da seed della patch e id del nodo', () => {
    const p = patch([{ id: 'p1', module: 'probe' }, { id: 'p2', module: 'probe', seed: 77 }], [], 5);
    const g = build(p);
    expect(g.node('p1').seed).toBe(hash32(5, hashString('p1')));
    expect(g.node('p2').seed).toBe(77);
  });

  it('stessa patch → stessi valori casuali; seed della patch diverso → valori diversi', () => {
    const run = (seed: number) => {
      const g = build(patch([{ id: 'p', module: 'probe' }], [], seed));
      const out: number[] = [];
      for (let k = 0; k < 20; k++) {
        g.process(k, k + 1);
        out.push(ctl(g, 'p', 'out').values[0]!);
      }
      return out;
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });

  it('la config è una copia: la patch non la condivide con il nodo', () => {
    const config = { table: [9] };
    const g = build(patch([{ id: 'p', module: 'probe', config }, { id: 'q', module: 'probe' }]));
    config.table.push(10);
    expect(g.node('p').ctx.config).toEqual({ table: [9] });
    expect(g.node('q').ctx.config).toEqual({ table: [1, 2, 3] });
  });
});

describe('validateManifest', () => {
  it('porte duplicate nello stesso lato sono errori, tra ingresso e uscita no', async () => {
    const { validateManifest } = await import('../../src/core/registry');
    const base = { id: 'm', name: 'M', category: 'logic' as const, rate: 'control' as const, params: [], seeded: false };
    expect(validateManifest({ ...base, inputs: [{ id: 'x', type: 'phase' }], outputs: [{ id: 'x', type: 'phase' }] })).toEqual([]);
    expect(validateManifest({ ...base, inputs: [{ id: 'x', type: 'phase' }, { id: 'x', type: 'control' }], outputs: [] })[0]).toMatch(/duplicata/);
    expect(validateManifest({ ...base, inputs: [{ id: 'a.b', type: 'phase' }], outputs: [] })[0]).toMatch(/non valido/);
    expect(validateManifest({ ...base, inputs: [], outputs: [{ id: 'p', type: 'phase', signal: 'gate' }] })[0]).toMatch(/signal/);
  });
});
