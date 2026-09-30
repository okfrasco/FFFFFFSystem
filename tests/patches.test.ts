import { describe, expect, it } from 'vitest';
import { splitAudio } from '../src/core/audioSplit';
import { splitFrame } from '../src/core/frameSplit';
import { Graph } from '../src/core/graph';
import type { Patch } from '../src/core/types';
import { audioRegistry, frameRegistry, moduleRegistry } from '../src/modules';
import demo from '../patches/demo.json';

describe('patch di esempio', () => {
  it('si costruisce nel main e, divisa, nel worklet e nel renderer dei visual', () => {
    const p = demo as Patch;
    expect(() => Graph.build(p, moduleRegistry)).not.toThrow();
    const split = splitAudio(p, moduleRegistry);
    expect(split.bridges).toContain('melody.note');
    expect(split.bridges).toContain('kick.trig');
    const audioReg = audioRegistry;
    expect(() => Graph.build(split.patch, audioReg, { rate: 'audio', audio: { sampleRate: 48000, frames: 128 } })).not.toThrow();
    const frame = splitFrame(p, moduleRegistry);
    expect(frame.patch.nodes.some((n) => n.module === 'screen')).toBe(true);
    const frameReg = frameRegistry;
    expect(() => Graph.build(frame.patch, frameReg, { rate: 'frame' })).not.toThrow();
  });
});
