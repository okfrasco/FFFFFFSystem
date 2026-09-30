#version 300 es
// Pattern — griglie, cerchi, linee, moiré
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uType;
uniform float uScale;
uniform float uThickness;
uniform float uLayers;
uniform float uAngleOffset;
uniform float uDistort;
uniform float uHue;
uniform float uSaturation;
uniform float uSeed;

#define PI 3.14159265359

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Cerchi concentrici
float circles(vec2 p, float t) {
  float d = length(p) - t;
  return abs(fract(d * uScale) - 0.5) < uThickness ? 1.0 : 0.0;
}

// Linee parallele
float lines(vec2 p, float angle) {
  vec2 r = rot2(angle) * p;
  return abs(fract(r.x * uScale) - 0.5) < uThickness ? 1.0 : 0.0;
}

// Griglia
float grid(vec2 p) {
  vec2 g = abs(fract(p * uScale) - 0.5);
  return (g.x < uThickness || g.y < uThickness) ? 1.0 : 0.0;
}

// Onde sinusoidali
float waves(vec2 p, float t) {
  float y = p.y + sin(p.x * uScale + t * PI * 2.0) * 0.1;
  return abs(fract(y * uScale) - 0.5) < uThickness ? 1.0 : 0.0;
}

// Esagoni
float hexagon(vec2 p) {
  p = abs(p);
  return max(p.x * 0.866025 + p.y * 0.5, p.y) - 1.0;
}

float hexGrid(vec2 p) {
  vec2 r = vec2(1.0, 1.732);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = length(a) < length(b) ? a : b;
  float d = hexagon(g * uScale / 3.0);
  return abs(d) < uThickness * 0.5 ? 1.0 : 0.0;
}

// Voronoi
float voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash(n + g + uSeed), hash(n + g + uSeed + 100.0));
      vec2 r = g + o - f;
      float d = dot(r, r);
      md = min(md, d);
    }
  }
  return md;
}

float pattern(vec2 p, float t, int type) {
  if (type == 0) return circles(p, t);
  if (type == 1) return lines(p, t * PI);
  if (type == 2) return grid(p + t * 0.1);
  if (type == 3) return waves(p, t);
  if (type == 4) return hexGrid(p + t * 0.1);
  // Voronoi
  float v = voronoi(p * uScale * 0.3 + t * 0.5);
  return v < uThickness * 2.0 ? 1.0 : 0.0;
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  // Distortion
  if (uDistort > 0.01) {
    float d = uDistort * 0.2;
    uv += d * vec2(sin(uv.y * 10.0 + uTime * PI * 2.0), cos(uv.x * 10.0 + uTime * PI * 2.0));
  }

  int type = int(uType);
  int layers = int(uLayers);

  float val = 0.0;

  for (int i = 0; i < 4; i++) {
    if (i >= layers) break;
    float angle = float(i) * uAngleOffset;
    vec2 p = rot2(angle) * uv;
    float timeOffset = float(i) * 0.25 + uSeed;
    val += pattern(p, uTime + timeOffset, type);
  }

  // Moiré from overlapping
  val = fract(val);

  vec3 col;
  if (uSaturation < 0.01) {
    col = vec3(val);
  } else {
    col = hsv2rgb(vec3(uHue + val * 0.3, uSaturation, val));
  }

  outColor = vec4(col, 1.0);
}
