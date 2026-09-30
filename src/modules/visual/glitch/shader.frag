#version 300 es
// Glitch effects — RGB shift, scanlines, blocks, wave
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform float uTime;
uniform float uPhase;
uniform float uMode;
uniform float uAmount;
uniform float uBlockSize;
uniform float uRgbSplit;
uniform float uNoise;
uniform float uSeed;

#define PI 3.14159265359

float hash(float n) { return fract(sin(n + uSeed) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453); }

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

void main() {
  vec2 uv = vUv;
  int mode = int(uMode);

  // Global glitch timing
  float glitchTime = uPhase * 10.0;
  float glitchTrigger = step(0.95, hash(floor(glitchTime)));

  if (mode == 0) {
    // RGB shift
    float shift = uRgbSplit * (1.0 + sin(uPhase * PI * 4.0) * 0.5);
    if (glitchTrigger > 0.5) shift *= 3.0;

    float r = texture(uIn, uv + vec2(shift, 0.0)).r;
    float g = texture(uIn, uv).g;
    float b = texture(uIn, uv - vec2(shift, 0.0)).b;
    outColor = vec4(r, g, b, 1.0);

  } else if (mode == 1) {
    // Scanlines with distortion
    float scanline = sin(uv.y * uResolution.y * 0.5) * 0.5 + 0.5;
    scanline = pow(scanline, 2.0);

    float distort = noise(uv.y * 20.0 + uPhase * 5.0) * 2.0 - 1.0;
    if (glitchTrigger > 0.5) distort *= uAmount * 0.2;
    else distort *= uAmount * 0.02;

    vec2 sampleUv = uv + vec2(distort, 0.0);
    vec4 col = texture(uIn, sampleUv);
    col.rgb *= 0.8 + 0.2 * scanline;
    outColor = col;

  } else if (mode == 2) {
    // Block glitch
    vec2 block = floor(uv * uResolution / uBlockSize);
    float blockRand = hash2(block + floor(uPhase * 5.0));

    vec2 offset = vec2(0.0);
    if (blockRand > 1.0 - uAmount * 0.3) {
      offset.x = (hash2(block + 1.0) - 0.5) * uAmount;
      offset.y = (hash2(block + 2.0) - 0.5) * uAmount * 0.2;
    }

    // Color corruption
    vec4 col = texture(uIn, uv + offset);
    if (blockRand > 1.0 - uAmount * 0.1) {
      col.rgb = col.gbr; // Channel swap
    }

    outColor = col;

  } else {
    // Wave distortion
    float wave = sin(uv.y * 20.0 + uPhase * PI * 4.0) * uAmount * 0.05;
    wave += sin(uv.y * 7.0 - uPhase * PI * 2.0) * uAmount * 0.03;

    if (glitchTrigger > 0.5) {
      wave += (hash(floor(uv.y * 50.0 + uPhase * 20.0)) - 0.5) * uAmount * 0.1;
    }

    vec2 sampleUv = uv + vec2(wave, 0.0);
    outColor = texture(uIn, sampleUv);
  }

  // Add noise
  if (uNoise > 0.01) {
    float n = hash2(uv * uResolution + uTime * 100.0);
    outColor.rgb += (n - 0.5) * uNoise;
  }
}
