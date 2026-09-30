import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { noteCrossings } from './index';
import { parseSmf, writeSmf, type ClipNote } from './smf';

const NOTES: ClipNote[] = [
  [0, 1, 60, 1, 0],
  [1, 0.5, 64, 0.5, 0],
  [2.5, 1.5, 67, 0.75, 0],
];

describe('parseSmf', () => {
  it('rilegge le note scritte da writeSmf', () => {
    const clip = parseSmf(writeSmf(NOTES));
    expect(clip.length).toBe(4);
    expect(clip.notes.map(([s, d, p, v]) => [s, d, p, Math.round(v * 4) / 4])).toEqual(NOTES.map(([s, d, p, v]) => [s, d, p, v]));
  });

  it('rifiuta ciò che non è MIDI', () => {
    expect(() => parseSmf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

describe('noteCrossings', () => {
  it('in avanti e all indietro, con la ripetizione della clip', () => {
    expect(noteCrossings(1, 4, 0, 6)).toEqual([1, 5]);
    expect(noteCrossings(1, 4, 6, 0)).toEqual([5, 1]);
    expect(noteCrossings(0, 4, 0, 0.1)).toEqual([0]);
  });
});

describe('MIDI Clip', () => {
  const clip = { name: 't', notes: NOTES, length: 4, tracks: 1 };
  it('4 beat per battuta: le note al loro beat, durate in secondi', () => {
    const sim = simulate([TRANSPORT, { id: 'm', module: 'midiClip', config: clip }], [{ from: 'tr.bar', to: 'm.phase' }], ['m.note']);
    sim.runTo(2);
    const ev = sim.events('m.note').map((e) => (e.kind === 'note' ? [e.t, e.pitch, e.dur] : []));
    expect(ev).toEqual([
      [0, 60, 0.5],
      [0.5, 64, 0.25],
      [1.25, 67, 0.75],
      [2, 60, 0.5],
      [2.5, 64, 0.25],
      [3.25, 67, 0.75],
    ].map((r) => r.map((x) => expect.closeTo(x, 6))));
  });

  it('2 beat per ciclo: la clip dura due battute e le note si allungano', () => {
    const sim = simulate([TRANSPORT, { id: 'm', module: 'midiClip', params: { beats: 2 }, config: clip }], [{ from: 'tr.bar', to: 'm.phase' }], ['m.note']);
    sim.runTo(2);
    expect(sim.events('m.note').map((e) => (e.kind === 'note' ? [e.t, e.dur] : []))).toEqual([
      [0, 1],
      [1, 0.5],
      [2.5, 1.5],
    ].map((r) => r.map((x) => expect.closeTo(x, 6))));
  });
});
