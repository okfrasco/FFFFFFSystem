import { describe, expect, it } from 'vitest';
import { createControl, mergeControl, readVoice } from '../../src/core/signals';

describe('readVoice', () => {
  it('avvolge come mc: meno voci della richiesta si ripetono', () => {
    const a = [10, 20, 30];
    expect([0, 1, 2, 3, 4].map((v) => readVoice(a, v))).toEqual([10, 20, 30, 10, 20]);
    expect(readVoice(a, -1)).toBe(30);
    expect(readVoice([], 3)).toBe(0);
  });
});

describe('mergeControl', () => {
  it('somma per voce con avvolgimento e ordina gli eventi', () => {
    const a = createControl(1);
    a.values[0] = 1;
    a.events.push({ kind: 'trig', t: 0.3, voice: 0, vel: 1 });
    const b = createControl(3);
    b.values.set([1, 2, 3]);
    b.events.push({ kind: 'trig', t: 0.1, voice: 2, vel: 1 });
    const into = createControl();
    into.events.push({ kind: 'trig', t: 9, voice: 0, vel: 1 }); // residuo da svuotare
    mergeControl(into, [a, b]);
    expect(Array.from(into.values)).toEqual([2, 3, 4]);
    expect(into.events.map((e) => e.t)).toEqual([0.1, 0.3]);
  });
});
