#version 300 es
// Flow field — linee che seguono un campo vettoriale
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uPrev;
uniform float uTime;
uniform float uPhase;
uniform float uLines;
uniform float uLength;
uniform float uThickness;
uniform float uScale;
uniform float uCurl;
uniform float uHue;
uniform float uHueSpread;
uniform float uFade;
uniform float uSeed;

#define PI 3.14159265359

float hash(float n) { return fract(sin(n) * 43758.5453); }

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Simplex noise for flow field
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865, 0.366025404, -0.577350269, 0.024390243);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 a0 = x - floor(x + 0.5);
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Get flow direction from curl noise
vec2 getFlow(vec2 p, float t) {
  float eps = 0.01;
  float n = snoise(p * uScale + t);
  float nx = snoise((p + vec2(eps, 0.0)) * uScale + t);
  float ny = snoise((p + vec2(0.0, eps)) * uScale + t);

  // Curl: perpendicular to gradient
  vec2 grad = vec2(nx - n, ny - n) / eps;
  return normalize(vec2(-grad.y, grad.x)) * uCurl + grad * (1.0 - uCurl);
}

// Distance to line segment
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect;

  // Fade previous frame
  vec4 prev = texture(uPrev, uv) * uFade;

  vec3 col = prev.rgb;
  float lines = uLines;
  float len = uLength;

  for (float i = 0.0; i < 1000.0; i++) {
    if (i >= lines) break;

    // Starting position for this line (deterministic)
    float id = i + uSeed;
    vec2 start = vec2(
      hash(id * 1.234) - 0.5,
      hash(id * 2.345) - 0.5
    ) * aspect;

    // Follow the flow field
    vec2 pos = start;
    vec2 prevPos = pos;
    float stepSize = 0.01;

    float minDist = 1000.0;
    float alongLine = 0.0;

    for (float j = 0.0; j < 100.0; j++) {
      if (j >= len) break;

      vec2 flow = getFlow(pos + uSeed * 0.1, uPhase);
      prevPos = pos;
      pos += flow * stepSize;

      // Check distance to this segment
      float d = sdSegment(p, prevPos, pos);
      if (d < minDist) {
        minDist = d;
        alongLine = j / len;
      }
    }

    // Draw if close enough
    float thickness = uThickness / uResolution.y;
    float intensity = smoothstep(thickness, 0.0, minDist);

    if (intensity > 0.01) {
      float hue = uHue + hash(id * 3.456) * uHueSpread;
      vec3 lineCol = hsv2rgb(vec3(hue, 0.7, 0.9)) * intensity * (0.5 + 0.5 * alongLine);
      col += lineCol * 0.5;
    }
  }

  col = clamp(col, 0.0, 1.0);
  outColor = vec4(col, 1.0);
}
