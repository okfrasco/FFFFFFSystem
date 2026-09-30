/**
 * Campioni nel browser: decodifica dei file audio (WAV, AIFF, MP3, OGG… quel
 * che il browser sa leggere) e salvataggio in IndexedDB, così dopo un
 * ricaricamento la patch ritrova i suoi campioni. I campioni in memoria stanno
 * in core/samples.ts; l'host li manda anche al motore audio.
 */

import { registerSample, sampleId, type Sample } from '../core/samples';

const DB = 'ffffff';
const STORE = 'samples';
/** Oltre questa durata il file si tronca (memoria del worklet). */
const MAX_SECONDS = 120;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function save(s: Sample): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Carica in memoria tutti i campioni salvati (all'avvio). */
export async function loadStoredSamples(): Promise<number> {
  try {
    const db = await openDb();
    const all = await new Promise<Sample[]>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as Sample[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    for (const s of all) registerSample(s);
    return all.length;
  } catch {
    return 0; // IndexedDB non disponibile (navigazione privata): i campioni restano solo in memoria
  }
}

/** Decodifica un file audio, lo registra e lo salva. */
export async function importAudioFile(file: File): Promise<Sample> {
  const data = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const buf = await ctx.decodeAudioData(data);
  const len = Math.min(buf.length, Math.round(MAX_SECONDS * buf.sampleRate));
  const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c).slice(0, len));
  const s: Sample = { id: sampleId(channels, buf.sampleRate), name: file.name.replace(/\.[^.]+$/, ''), sampleRate: buf.sampleRate, channels };
  registerSample(s);
  try {
    await save(s);
  } catch {
    // resta in memoria per questa sessione
  }
  return s;
}
