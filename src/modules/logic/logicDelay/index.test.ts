import { describe, expect, it } from 'vitest';
import type { ControlEvent } from '../../../core/types';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

function run(events: ControlEvent[], params: Record<string, number>) {
  const sim = simulate(
    [TRANSPORT, { id: 'src', module: 'script', config: { events } }, { id: 'd', module: 'logicDelay', params }],
    [{ from: 'src.out', to: 'd.gate' }],
    ['d.gate'],
  );
  sim.runTo(1);
  return (sim.events('d.gate') as { t: number; on: boolean }[]).map((e) => [+e.t.toFixed(6), e.on]);
}

const gate = (t: number, on: boolean): ControlEvent => ({ kind: 'gate', t, voice: 0, on });

describe('Logic Delay', () => {
  it('apertura e chiusura ritardate separatamente', () => {
    expect(run([gate(0.1, true), gate(0.5, false)], { on: 0.05, off: 0.2 })).toEqual([
      [0.15, true],
      [0.7, false],
    ]);
  });

  it('un gate più corto del ritardo di apertura sparisce', () => {
    expect(run([gate(0.1, true), gate(0.12, false)], { on: 0.05, off: 0 })).toEqual([]);
  });

  it('un trigger diventa un gate lungo quanto il ritardo di chiusura', () => {
    expect(run([{ kind: 'trig', t: 0.2, voice: 0, vel: 1 }], { on: 0, off: 0.3 })).toEqual([
      [0.2, true],
      [0.5, false],
    ]);
  });

  it('se l\'ingresso si riapre durante la chiusura ritardata, l\'uscita resta aperta', () => {
    expect(run([gate(0.1, true), gate(0.3, false), gate(0.4, true), gate(0.8, false)], { on: 0, off: 0.2 })).toEqual([
      [0.1, true],
      [1, false],
    ]);
  });
});
