#version 300 es
// Oscilloscope — audio waveform visualization
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uWaveform;
uniform sampler2D uPrev;
uniform float uMode;
uniform float uThickness;
uniform float uZoom;
uniform float uGlow;
uniform float uPersistence;
uniform float uHue;
uniform float uRotate;

#define PI 3.14159265359
#define SAMPLES 256

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float getSample(float t) {
  return texture(uWaveform, vec2(t, 0.5)).r;
}

// Distance to line segment
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  uv = rot2(uRotate) * uv;
  uv /= uZoom;

  int mode = int(uMode);
  float minDist = 1000.0;
  float brightness = 0.0;

  float thickness = uThickness / uResolution.y;

  if (mode == 0) {
    // Linear waveform
    for (int i = 0; i < SAMPLES - 1; i++) {
      float t1 = float(i) / float(SAMPLES);
      float t2 = float(i + 1) / float(SAMPLES);
      float s1 = getSample(t1);
      float s2 = getSample(t2);
      vec2 p1 = vec2(t1 - 0.5, s1 * 0.4);
      vec2 p2 = vec2(t2 - 0.5, s2 * 0.4);
      float d = sdSegment(uv, p1, p2);
      minDist = min(minDist, d);
    }
  } else if (mode == 1) {
    // XY mode (Lissajous)
    for (int i = 0; i < SAMPLES - 1; i++) {
      float t1 = float(i) / float(SAMPLES);
      float t2 = float(i + 1) / float(SAMPLES);
      float s1 = getSample(t1);
      float s2 = getSample(t2);
      // Use adjacent samples as X and Y
      float s1b = getSample(t1 + 0.25);
      float s2b = getSample(t2 + 0.25);
      vec2 p1 = vec2(s1, s1b) * 0.4;
      vec2 p2 = vec2(s2, s2b) * 0.4;
      float d = sdSegment(uv, p1, p2);
      minDist = min(minDist, d);
    }
  } else {
    // Radial mode
    for (int i = 0; i < SAMPLES - 1; i++) {
      float t1 = float(i) / float(SAMPLES);
      float t2 = float(i + 1) / float(SAMPLES);
      float angle1 = t1 * PI * 2.0;
      float angle2 = t2 * PI * 2.0;
      float r1 = 0.2 + getSample(t1) * 0.2;
      float r2 = 0.2 + getSample(t2) * 0.2;
      vec2 p1 = vec2(cos(angle1), sin(angle1)) * r1;
      vec2 p2 = vec2(cos(angle2), sin(angle2)) * r2;
      float d = sdSegment(uv, p1, p2);
      minDist = min(minDist, d);
    }
  }

  // Calculate brightness with glow
  brightness = smoothstep(thickness + thickness * uGlow, 0.0, minDist);

  // Add soft glow
  float glow = exp(-minDist * 50.0 / (1.0 + uGlow)) * uGlow * 0.5;
  brightness += glow;

  // Persistence from previous frame
  vec4 prev = texture(uPrev, vUv);
  vec3 prevCol = prev.rgb * uPersistence;

  // Current color
  vec3 col = hsv2rgb(vec3(uHue, 0.6, brightness));

  // Combine
  col = max(col, prevCol);

  outColor = vec4(col, 1.0);
}
