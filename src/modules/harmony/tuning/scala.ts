/**
 * File Scala (.scl): la descrizione, il numero di note, poi una nota per riga
 * in cents (con il punto) o come rapporto (3/2, 2). L'ultima è il periodo
 * (di solito l'ottava, 1200 cents).
 */

export interface Tuning {
  name: string;
  /** Cents di ogni grado dopo lo 0; l'ultimo è il periodo. */
  cents: number[];
}

export function ratioToCents(r: number): number {
  return 1200 * Math.log2(r);
}

export function parseScala(text: string): Tuning {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('!'));
  const name = lines[0] ?? '';
  const count = parseInt(lines[1] ?? '', 10);
  if (!(count > 0)) throw new Error('file Scala non valido: manca il numero di note');
  const cents: number[] = [];
  for (const line of lines.slice(2)) {
    if (cents.length >= count) break;
    const tok = line.split(/\s+/)[0];
    if (!tok) continue;
    if (tok.includes('.')) cents.push(parseFloat(tok));
    else if (tok.includes('/')) {
      const [a, b] = tok.split('/').map(Number);
      cents.push(ratioToCents(a! / b!));
    } else cents.push(ratioToCents(Number(tok)));
    if (!Number.isFinite(cents.at(-1)!)) throw new Error(`riga non valida: ${line}`);
  }
  if (cents.length !== count) throw new Error('file Scala incompleto');
  return { name: name || 'scala', cents };
}

const ratios = (name: string, rs: number[]): Tuning => ({ name, cents: rs.map(ratioToCents) });
const edo = (name: string, n: number, period = 1200): Tuning => ({ name, cents: Array.from({ length: n }, (_, i) => ((i + 1) * period) / n) });

export const PRESETS: readonly Tuning[] = [
  edo('12-TET', 12),
  ratios('giusta 5-limite', [16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8, 2]),
  ratios('pitagorica', [256 / 243, 9 / 8, 32 / 27, 81 / 64, 4 / 3, 729 / 512, 3 / 2, 128 / 81, 27 / 16, 16 / 9, 243 / 128, 2]),
  ratios('armonici 8–16', [9 / 8, 10 / 8, 11 / 8, 12 / 8, 13 / 8, 14 / 8, 15 / 8, 2]),
  edo('19-TET', 19),
  edo('24-TET (quarti di tono)', 24),
  edo('31-TET', 31),
  edo('Bohlen-Pierce (13 su 3:1)', 13, ratioToCents(3)),
  { name: 'slendro (approssimato)', cents: [240, 480, 720, 960, 1200] },
  { name: 'pelog (approssimato)', cents: [120, 270, 540, 670, 785, 950, 1200] },
];

/** Altezza (MIDI frazionaria) del tasto `note` con `base` come tasto che resta fermo. */
export function tune(note: number, base: number, t: Tuning): number {
  const n = t.cents.length;
  if (n === 0) return note;
  const k = Math.round(note) - base;
  const o = Math.floor(k / n);
  const step = k - o * n;
  const period = t.cents[n - 1]!;
  const c = o * period + (step === 0 ? 0 : t.cents[step - 1]!);
  return base + c / 100 + (note - Math.round(note));
}
