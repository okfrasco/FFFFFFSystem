#version 300 es
// Sistema di particelle — simulato nello shader con hash deterministico
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uPrev;
uniform float uTime;
uniform float uPhase;
uniform float uCount;
uniform float uSize;
uniform float uSpeed;
uniform float uLife;
uniform float uGravity;
uniform float uFriction;
uniform float uNoise;
uniform float uSpread;
uniform float uEmitMode;
uniform float uHue;
uniform float uFade;
uniform float uSeed;
uniform float uDt;

#define PI 3.14159265359

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Simplex 2D noise
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = step(a.yx, a.xy);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash22(i)), dot(b, hash22(i + o)), dot(c, hash22(i + 1.0)));
  return dot(n, vec3(70.0));
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect;

  // Fade previous frame
  vec4 prev = texture(uPrev, uv) * uFade;

  float brightness = 0.0;
  vec3 particleColor = vec3(0.0);
  float count = uCount;

  for (float i = 0.0; i < 2000.0; i++) {
    if (i >= count) break;

    // Deterministic particle properties based on index and seed
    float id = i + uSeed;
    float birthTime = hash(id * 1.234) * uLife;
    float age = mod(uTime - birthTime, uLife);
    float lifeRatio = age / uLife;

    if (lifeRatio > 1.0) continue;

    // Initial position based on emit mode
    vec2 startPos;
    float angle = hash(id * 2.345) * PI * 2.0;
    float emitMode = uEmitMode;

    if (emitMode < 0.5) {
      // Continuous from center
      startPos = vec2(0.0);
    } else if (emitMode < 1.5) {
      // Burst - emit at phase transitions
      float burstPhase = floor(uPhase * 4.0) / 4.0;
      startPos = vec2(hash(id + burstPhase) - 0.5, hash(id * 3.0 + burstPhase) - 0.5) * 0.2;
    } else {
      // Ring
      startPos = vec2(cos(angle), sin(angle)) * 0.3;
    }

    // Initial velocity
    float spread = uSpread * PI;
    float velAngle = angle + (hash(id * 4.567) - 0.5) * spread;
    vec2 vel = vec2(cos(velAngle), sin(velAngle)) * uSpeed * (0.5 + hash(id * 5.678) * 0.5);

    // Simulate position
    vec2 pos = startPos;
    float t = age;
    float dt = 0.016;

    // Simplified physics integration
    pos += vel * t;
    pos.y -= 0.5 * uGravity * t * t;

    // Apply noise displacement
    if (uNoise > 0.01) {
      vec2 noiseOffset = vec2(
        noise(pos * 3.0 + uTime * 0.5),
        noise(pos * 3.0 + uTime * 0.5 + 100.0)
      );
      pos += noiseOffset * uNoise * t * 0.3;
    }

    // Friction decay
    pos *= exp(-uFriction * t);

    // Distance to particle
    float d = length(p - pos);
    float size = uSize / uResolution.y * (1.0 - lifeRatio * 0.5);
    float intensity = smoothstep(size, 0.0, d) * (1.0 - lifeRatio);

    brightness += intensity;

    // Color variation per particle
    float hueOffset = hash(id * 6.789) * 0.2;
    particleColor += hsv2rgb(vec3(uHue + hueOffset + lifeRatio * 0.1, 0.8, intensity));
  }

  // Combine with previous frame
  vec3 col = prev.rgb + particleColor;
  col = clamp(col, 0.0, 1.0);

  outColor = vec4(col, 1.0);
}
