import { describe, expect, it } from 'vitest';
import { SR, audioSim, note, rms } from '../../../../tests/helpers/audio';

function pluck(params: Record<string, number>, events = [note(0.01, 69, 2)], seconds = 1.5, seed = 1) {
  return audioSim(
    [{ id: 'src', module: 'eventSource', config: { events } }, { id: 'k', module: 'karplus', params }],
    [{ from: 'src.out', to: 'k.note' }],
    ['k.out'],
    seed,
  )
    .run(seconds)
    .get('k.out')![0]!;
}

/** Frequenza fondamentale per autocorrelazione, con interpolazione parabolica del picco. */
function pitchOf(x: Float32Array, from: number, to: number, fmin = 50, fmax = 2000): number {
  const a = Math.floor(from * SR);
  const b = Math.floor(to * SR);
  const ac = (lag: number) => {
    let s = 0;
    for (let i = a; i < b; i++) s += x[i]! * x[i + lag]!;
    return s;
  };
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(SR / fmax); lag <= Math.ceil(SR / fmin); lag++) {
    const c = ac(lag);
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  const y0 = ac(bestLag - 1);
  const y1 = best;
  const y2 = ac(bestLag + 1);
  const shift = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
  return SR / (bestLag + shift);
}

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

describe('Karplus-Strong', () => {
  it('intonato: A4 = 440 Hz entro pochi cent, sia scuro sia brillante', () => {
    for (const brightness of [0, 0.6, 1]) {
      const x = pluck({ brightness, decay: 5 });
      expect(Math.abs(cents(pitchOf(x, 0.1, 0.3), 440)), `brillantezza ${brightness}`).toBeLessThan(5);
    }
  });

  it('anche nelle note basse e alte', () => {
    for (const [midi, hz] of [
      [45, 110],
      [81, 880],
    ] as const) {
      const x = pluck({ decay: 5 }, [note(0.01, midi, 2)]);
      expect(Math.abs(cents(pitchOf(x, 0.1, 0.3, 50, 2000), hz)), `nota ${midi}`).toBeLessThan(6);
    }
  });

  it('il decadimento segue il T60', () => {
    const x = pluck({ decay: 0.5, brightness: 1 }, [note(0.01, 57, 5)], 1.2);
    const early = rms(x, Math.floor(0.05 * SR), Math.floor(0.1 * SR));
    const late = rms(x, Math.floor(0.55 * SR), Math.floor(0.6 * SR));
    // mezzo secondo = −60 dB (con il filtro un po' di più)
    expect(20 * Math.log10(late / early)).toBeLessThan(-45);
  });

  it('il rilascio ferma la corda a fine nota', () => {
    const held = pluck({ decay: 5, release: 20 }, [note(0.01, 57, 0.2)], 1);
    const muted = pluck({ decay: 5, release: 0.05 }, [note(0.01, 57, 0.2)], 1);
    const tail = (x: Float32Array) => rms(x, Math.floor(0.5 * SR), Math.floor(0.6 * SR));
    expect(tail(muted)).toBeLessThan(tail(held) / 100);
  });

  it('polifonico: due note insieme suonano entrambe', () => {
    const x = pluck({ decay: 5, voices: 4 }, [note(0.01, 57, 2), note(0.01, 64, 2)]);
    const f = pitchOf(x, 0.1, 0.4, 100, 1000);
    // la somma di A3 e E4 ha periodo comune a 110 Hz (rapporto 2:3 con 220 e 330)
    expect(Math.abs(cents(f, 110))).toBeLessThan(10);
  });

  it('stesso seed stesso colpo', () => {
    expect(pluck({}, undefined, 0.2, 3)).toEqual(pluck({}, undefined, 0.2, 3));
  });
});
