/**
 * Lettura di un file MIDI standard (SMF, formato 0 e 1): solo le note, con
 * tempi in beat (semiminime). Il tempo del file si ignora: nel sistema il
 * tempo lo dà la fase che legge la clip.
 */

/** Una nota: [inizio in beat, durata in beat, altezza, velocity 0–1, traccia]. */
export type ClipNote = [number, number, number, number, number];

export interface Clip {
  notes: ClipNote[];
  /** Lunghezza in beat, arrotondata alla battuta di 4/4 per eccesso. */
  length: number;
  tracks: number;
}

export function parseSmf(bytes: Uint8Array): Clip {
  let pos = 0;
  const u8 = () => {
    if (pos >= bytes.length) throw new Error('file MIDI troncato');
    return bytes[pos++]!;
  };
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
  const vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = u8();
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('lunghezza variabile non valida');
  };

  if (tag() !== 'MThd') throw new Error('non è un file MIDI');
  const hlen = u32();
  const hstart = pos;
  u16(); // formato
  const ntracks = u16();
  const division = u16();
  if (division & 0x8000) throw new Error('tempo SMPTE non supportato');
  pos = hstart + hlen;

  const notes: ClipNote[] = [];
  let endTick = 0;
  let track = 0;
  for (let t = 0; t < ntracks && pos + 8 <= bytes.length; t++) {
    const id = tag();
    const len = u32();
    const end = pos + len;
    if (id !== 'MTrk') {
      pos = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    let hasNotes = false;
    const open = new Map<number, [number, number][]>(); // canale·128+altezza → [inizio, vel]
    while (pos < end) {
      tick += vlq();
      let b = u8();
      if (b < 0x80) {
        pos--; // running status
        b = status;
      } else if (b < 0xf0) status = b;
      // (la lunghezza va letta prima: `pos += vlq()` sommerebbe il pos di prima della lettura)
      if (b === 0xff) {
        u8();
        const skip = vlq();
        pos += skip;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        const skip = vlq();
        pos += skip;
        continue;
      }
      const type = b & 0xf0;
      const ch = b & 0x0f;
      if (type === 0xc0 || type === 0xd0) {
        u8();
        continue;
      }
      const d1 = u8();
      const d2 = u8();
      const key = ch * 128 + d1;
      if (type === 0x90 && d2 > 0) {
        const list = open.get(key) ?? [];
        list.push([tick, d2]);
        open.set(key, list);
      } else if (type === 0x80 || type === 0x90) {
        const on = open.get(key)?.shift();
        if (on) {
          notes.push([on[0] / division, (tick - on[0]) / division, d1, on[1] / 127, track]);
          hasNotes = true;
        }
      }
    }
    // note rimaste aperte: finiscono con la traccia
    for (const [key, list] of open) for (const [start, vel] of list) notes.push([start / division, (tick - start) / division, key % 128, vel / 127, track]);
    endTick = Math.max(endTick, tick);
    pos = end;
    if (hasNotes || open.size > 0) track++;
  }
  notes.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  let last = endTick / division;
  for (const n of notes) last = Math.max(last, n[0] + n[1]);
  return { notes, length: Math.max(4, Math.ceil(last / 4 - 1e-9) * 4), tracks: track };
}

/** Scrive un SMF formato 0 con le note date (per i test e per esportare). */
export function writeSmf(notes: readonly ClipNote[], division = 96): Uint8Array {
  const ev: { tick: number; bytes: number[] }[] = [];
  for (const [start, dur, pitch, vel] of notes) {
    ev.push({ tick: Math.round(start * division), bytes: [0x90, pitch, Math.max(1, Math.round(vel * 127))] });
    ev.push({ tick: Math.round((start + dur) * division), bytes: [0x80, pitch, 0] });
  }
  ev.sort((a, b) => a.tick - b.tick || a.bytes[0]! - b.bytes[0]!);
  const body: number[] = [];
  const vlq = (v: number) => {
    const out = [v & 0x7f];
    while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80);
    body.push(...out);
  };
  let t = 0;
  for (const e of ev) {
    vlq(e.tick - t);
    t = e.tick;
    body.push(...e.bytes);
  }
  vlq(0);
  body.push(0xff, 0x2f, 0x00);
  const be32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  return new Uint8Array([
    ...[0x4d, 0x54, 0x68, 0x64], ...be32(6), 0, 0, 0, 1, (division >> 8) & 255, division & 255,
    ...[0x4d, 0x54, 0x72, 0x6b], ...be32(body.length), ...body,
  ]);
}
