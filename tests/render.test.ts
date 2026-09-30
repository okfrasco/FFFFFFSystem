/**
 * Esporta la patch di esempio in WAV (solo con RENDER=1):
 *   RENDER=1 npx vitest run tests/render.test.ts
 * Scrive render/demo.wav (30 s, oppure SECONDS=…).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeWav, renderOffline } from '../src/core/offline';
import type { Patch } from '../src/core/types';
import { audioRegistry, moduleRegistry } from '../src/modules';
import demo from '../patches/demo.json';

describe.runIf(process.env.RENDER)('render', () => {
  it('demo.wav', () => {
    const seconds = Number(process.env.SECONDS ?? 30);
    const r = renderOffline(demo as Patch, moduleRegistry, audioRegistry, { seconds, sampleRate: 48000 });
    mkdirSync('render', { recursive: true });
    writeFileSync('render/demo.wav', encodeWav(r.left, r.right, r.sampleRate));
    let peak = 0;
    for (const x of r.left) peak = Math.max(peak, Math.abs(x));
    expect(peak).toBeGreaterThan(0.05);
  });
});
