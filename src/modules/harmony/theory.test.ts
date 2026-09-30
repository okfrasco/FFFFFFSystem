import { describe, expect, it } from 'vitest';
import { MODES, SUS_VARIANTS, brightnessMode, diatonicChord, fifthsPos, plr, scalePcs, susBasses, triadPcs, voiceLead } from './theory';

describe('brightness modale', () => {
  it('dal lidio al locrio, poi il lidio un semitono sotto', () => {
    expect(brightnessMode(0, 0)).toEqual({ root: 0, mode: 0 });
    expect(brightnessMode(0, 6)).toEqual({ root: 0, mode: 6 });
    expect(brightnessMode(0, 7)).toEqual({ root: 11, mode: 0 });
    expect(brightnessMode(0, -1)).toEqual({ root: 1, mode: 6 });
  });

  it('ogni passo cambia una nota sola', () => {
    const at = (n: number) => {
      const k = brightnessMode(0, n);
      return scalePcs(k.root, MODES[k.mode]!.steps);
    };
    for (let n = -10; n < 20; n++) {
      const a = at(n);
      const b = at(n + 1);
      expect(a.filter((p) => !b.includes(p))).toHaveLength(1);
    }
  });

  it('posizione sul cerchio delle quinte', () => {
    expect([7, 5, 6, 2, 10].map(fifthsPos)).toEqual([1, -1, 6, 2, -2]);
  });
});

describe('accordi', () => {
  it('per terze sul secondo grado di Do maggiore: Rem7', () => {
    expect(diatonicChord([0, 2, 4, 5, 7, 9, 11], 1, 4)).toEqual([2, 5, 9, 12]);
  });
});

describe('Sus Slash: bassi', () => {
  it('sus: tutti, i più tosti (♭2, ♯4) solo con tensione; ordinati dal più scuro', () => {
    const sus = SUS_VARIANTS[0]!;
    expect(susBasses(sus, 0)).toEqual([8, 3, 10, 5, 0, 7, 2, 9, 4, 11]);
    expect(susBasses(sus, 1)).toHaveLength(12);
  });

  it('sus♭5: la scala lidia; sus♭2♯5: la maggiore', () => {
    expect([...susBasses(SUS_VARIANTS[1]!, 1)].sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect([...susBasses(SUS_VARIANTS[5]!, 1)].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});

describe('voice leading', () => {
  it('da Do a Fa maggiore: il Do resta, Mi→Fa, Sol→La', () => {
    expect(voiceLead([60, 64, 67], [5, 9, 0], 3, 48, 84)).toEqual([60, 65, 69]);
  });
});

describe('Tonnetz', () => {
  it('P, L, R e la loro reversibilità', () => {
    const C = { root: 0, minor: false };
    expect(plr(C, 'P')).toEqual({ root: 0, minor: true });
    expect(plr(C, 'L')).toEqual({ root: 4, minor: true });
    expect(plr(C, 'R')).toEqual({ root: 9, minor: true });
    for (const op of ['P', 'L', 'R'] as const) expect(plr(plr(C, op), op)).toEqual(C);
    // ogni trasformazione cambia una nota sola
    for (const op of ['P', 'L', 'R'] as const) expect(triadPcs(plr(C, op)).filter((p) => !triadPcs(C).includes(p))).toHaveLength(1);
  });
});
