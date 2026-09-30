import { describe, expect, it } from 'vitest';
import { SR, audioSim, note } from '../../../../tests/helpers/audio';

function run(events: ReturnType<typeof note>[], params: Record<string, number>, seconds = 0.5) {
  const sim = audioSim(
    [{ id: 'src', module: 'eventSource', config: { events } }, { id: 'v', module: 'voices', params }],
    [{ from: 'src.out', to: 'v.note' }],
    ['v.pitch', 'v.gate', 'v.vel'],
  );
  const r = sim.run(seconds);
  return { pitch: r.get('v.pitch')!, gate: r.get('v.gate')!, vel: r.get('v.vel')! };
}

describe('Voci', () => {
  it('apre il gate al campione della nota e lo chiude dopo la durata', () => {
    const t = 0.1003;
    const { gate, pitch, vel } = run([note(t, 64, 0.05, 0.7)], { voices: 2 });
    const on = Math.floor(t * SR);
    expect(gate[0]![on - 1]).toBe(0);
    expect(gate[0]![on]).toBe(1);
    expect(pitch[0]![on]).toBe(64);
    expect(vel[0]![on]).toBeCloseTo(0.7, 6);
    const off = gate[0]!.indexOf(0, on);
    expect(Math.abs(off - (t + 0.05) * SR)).toBeLessThanOrEqual(1);
  });

  it('usa la voce libera da più tempo e, se sono tutte occupate, ruba la più vecchia', () => {
    const { pitch } = run([note(0.01, 60, 1), note(0.02, 62, 1), note(0.03, 64, 1)], { voices: 2 });
    const at = (s: number) => Math.floor(s * SR) + 5;
    expect([pitch[0]![at(0.02)], pitch[1]![at(0.02)]]).toEqual([60, 62]);
    expect([pitch[0]![at(0.03)], pitch[1]![at(0.03)]]).toEqual([64, 62]);
  });

  it('su una voce rubata il gate scende per un campione (l\'inviluppo riparte)', () => {
    const { gate } = run([note(0.01, 60, 1), note(0.02, 62, 1)], { voices: 1 });
    const f = Math.floor(0.02 * SR);
    expect([gate[0]![f - 1], gate[0]![f], gate[0]![f + 1]]).toEqual([1, 0, 1]);
  });

  it('un trigger con valore usa il valore come nota e dura `length`', () => {
    const { pitch, gate } = run([{ kind: 'trig', t: 0.01, voice: 0, vel: 1, value: 67 }], { voices: 1, length: 0.1 });
    const f = Math.floor(0.01 * SR);
    expect(pitch[0]![f]).toBe(67);
    expect(gate[0]!.indexOf(0, f)).toBeCloseTo(Math.floor(0.11 * SR), -1);
  });

  it('il glide porta la nota gradualmente', () => {
    const { pitch } = run([note(0.01, 48, 1), note(0.2, 60, 1)], { voices: 1, glide: 0.1 });
    const f = Math.floor(0.2 * SR);
    const mid = pitch[0]![f + Math.floor(0.03 * SR)]!;
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(59);
    expect(pitch[0]![f + Math.floor(0.25 * SR)]).toBeCloseTo(60, 1);
  });
});
