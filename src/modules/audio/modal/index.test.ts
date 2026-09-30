import { describe, expect, it } from 'vitest';
import { SR, audioSim, cents, note, pitchOf, rms } from '../../../../tests/helpers/audio';

const hit = (params: Record<string, number>, events = [note(0.01, 57, 2)], seconds = 1.2) =>
  audioSim([{ id: 'src', module: 'eventSource', config: { events } }, { id: 'm', module: 'modal', params }], [{ from: 'src.out', to: 'm.note' }], ['m.out'])
    .run(seconds)
    .get('m.out')![0]!;

describe('Modale', () => {
  it('la corda suona la sua nota', () => {
    const x = hit({ material: 0, decay: 3 });
    expect(Math.abs(cents(pitchOf(x, 0.1, 0.4), 220))).toBeLessThan(5);
  });

  it('decade con il T60', () => {
    const x = hit({ material: 1, decay: 0.3, damping: 0 });
    const early = rms(x, 0.02 * SR, 0.07 * SR);
    const late = rms(x, 0.52 * SR, 0.57 * SR);
    expect(20 * Math.log10(late / early)).toBeLessThan(-80);
  });

  it('tutti i materiali e i colpi suonano, senza esplodere', () => {
    for (let material = 0; material < 6; material++) {
      for (let exciter = 0; exciter < 3; exciter++) {
        const x = hit({ material, exciter }, undefined, 0.3);
        const r = rms(x);
        expect(r, `materiale ${material} colpo ${exciter}`).toBeGreaterThan(0.005);
        expect(r).toBeLessThan(0.9);
      }
    }
  });
});
