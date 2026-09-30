#version 300 es
// Typography — SDF-based character rendering
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uChar;
uniform float uSize;
uniform float uThickness;
uniform float uBlur;
uniform vec2 uOffset;
uniform float uRotate;
uniform float uHue;
uniform float uInvert;
uniform float uPhase;

#define PI 3.14159265359

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// SDF primitives
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float sdArc(vec2 p, float r, float a1, float a2) {
  float a = atan(p.y, p.x);
  if (a < a1) a += 2.0 * PI;
  if (a > a2) {
    vec2 p1 = r * vec2(cos(a1), sin(a1));
    vec2 p2 = r * vec2(cos(a2), sin(a2));
    return min(length(p - p1), length(p - p2));
  }
  return abs(length(p) - r);
}

// SDF for digits 0-9
float sdDigit(vec2 p, int digit) {
  float d = 1000.0;
  float w = 0.3;  // width
  float h = 0.5;  // height
  float t = 0.08; // segment thickness
  float r = 0.15; // corner radius

  if (digit == 0) {
    // Oval
    d = abs(length(p * vec2(1.0, 0.7)) - 0.35);
  } else if (digit == 1) {
    // Vertical line
    d = sdLine(p, vec2(0.0, -h), vec2(0.0, h));
  } else if (digit == 2) {
    // Complex shape
    d = min(d, sdArc(p - vec2(0.0, 0.25), 0.25, 0.0, PI));
    d = min(d, sdLine(p, vec2(0.25, 0.25), vec2(-0.25, -0.5)));
    d = min(d, sdLine(p, vec2(-0.25, -0.5), vec2(0.25, -0.5)));
  } else if (digit == 3) {
    d = min(d, sdArc(p - vec2(0.0, 0.25), 0.25, -PI * 0.5, PI * 0.5));
    d = min(d, sdArc(p - vec2(0.0, -0.25), 0.25, -PI * 0.5, PI * 0.5));
  } else if (digit == 4) {
    d = min(d, sdLine(p, vec2(-0.2, 0.5), vec2(-0.2, 0.0)));
    d = min(d, sdLine(p, vec2(-0.2, 0.0), vec2(0.25, 0.0)));
    d = min(d, sdLine(p, vec2(0.15, 0.5), vec2(0.15, -0.5)));
  } else if (digit == 5) {
    d = min(d, sdLine(p, vec2(0.25, 0.5), vec2(-0.2, 0.5)));
    d = min(d, sdLine(p, vec2(-0.2, 0.5), vec2(-0.2, 0.1)));
    d = min(d, sdArc(p - vec2(0.0, -0.15), 0.25, -PI * 0.6, PI * 0.6));
  } else if (digit == 6) {
    d = min(d, sdCircle(p - vec2(0.0, -0.2), 0.28));
    d = abs(d) - 0.02;
    float top = sdArc(p - vec2(0.0, 0.2), 0.28, PI * 0.3, PI);
    d = min(d, top);
  } else if (digit == 7) {
    d = min(d, sdLine(p, vec2(-0.25, 0.5), vec2(0.25, 0.5)));
    d = min(d, sdLine(p, vec2(0.25, 0.5), vec2(-0.1, -0.5)));
  } else if (digit == 8) {
    float c1 = abs(length(p - vec2(0.0, 0.22)) - 0.22);
    float c2 = abs(length(p - vec2(0.0, -0.22)) - 0.25);
    d = min(c1, c2);
  } else if (digit == 9) {
    d = min(d, sdCircle(p - vec2(0.0, 0.2), 0.28));
    d = abs(d) - 0.02;
    float bottom = sdArc(p - vec2(0.0, -0.2), 0.28, -PI, -PI * 0.3);
    d = min(d, bottom);
  }

  return d;
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  // Apply transforms
  uv -= uOffset;
  uv = rot2(uRotate) * uv;
  uv /= uSize;

  int digit = int(uChar);
  float d = sdDigit(uv, digit);

  // Apply thickness
  d = d - uThickness;

  // Smooth edge
  float alpha = 1.0 - smoothstep(-uBlur, uBlur, d);

  if (uInvert > 0.5) alpha = 1.0 - alpha;

  // Color
  vec3 col = hsv2rgb(vec3(uHue, 0.0, alpha));

  outColor = vec4(col, 1.0);
}
