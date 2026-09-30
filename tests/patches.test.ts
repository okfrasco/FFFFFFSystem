import { describe, expect, it } from 'vitest';
import { splitAudio } from '../src/core/audioSplit';
import { splitFrame } from '../src/core/frameSplit';
import { Graph } from '../src/core/graph';
import type { Patch } from '../src/core/types';
import { audioRegistry, frameRegistry, moduleRegistry } from '../src/modules';
import demo from '../patches/demo.json';
import acid303 from '../patches/acid-303.json';
import autechreGlitch from '../patches/autechre-glitch.json';
import generativeAmbient from '../patches/generative-ambient.json';
import susHarmony from '../patches/sus-harmony.json';
import tonnetzProgression from '../patches/tonnetz-progression.json';
import wonkyBeats from '../patches/wonky-beats.json';
import visualFlow from '../patches/visual-flow.json';
import visualGlitch from '../patches/visual-glitch.json';
import visualParticles from '../patches/visual-particles.json';
import visualReaction from '../patches/visual-reaction.json';
import visualSdf from '../patches/visual-sdf.json';

const allPatches: [string, Patch][] = [
  ['demo', demo as Patch],
  ['acid-303', acid303 as Patch],
  ['autechre-glitch', autechreGlitch as Patch],
  ['generative-ambient', generativeAmbient as Patch],
  ['sus-harmony', susHarmony as Patch],
  ['tonnetz-progression', tonnetzProgression as Patch],
  ['wonky-beats', wonkyBeats as Patch],
  ['visual-flow', visualFlow as Patch],
  ['visual-glitch', visualGlitch as Patch],
  ['visual-particles', visualParticles as Patch],
  ['visual-reaction', visualReaction as Patch],
  ['visual-sdf', visualSdf as Patch],
];

describe('patch di esempio', () => {
  it('demo: si costruisce nel main e, divisa, nel worklet e nel renderer dei visual', () => {
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

  for (const [name, patch] of allPatches) {
    it(`${name}: si costruisce senza errori`, () => {
      expect(() => Graph.build(patch, moduleRegistry)).not.toThrow();
    });
  }
});
