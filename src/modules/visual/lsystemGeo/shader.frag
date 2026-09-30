#version 300 es
// L-system geometry — render line segments
// Note: ideally segments would be passed as texture/SSBO, but for simplicity
// we generate them procedurally here matching the JS logic
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uSegmentCount;
uniform float uTotalSegments;
uniform float uThickness;
uniform float uRotate;
uniform float uZoom;
uniform float uHue;
uniform float uDepthColor;
uniform float uPhase;

#define PI 3.14159265359
#define MAX_ITER 7

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Distance to line segment
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Simple L-system generation in shader (limited but works for display)
// This matches the fractal tree system
void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  uv = rot2(uRotate) * uv;
  uv /= uZoom;
  uv.y -= 0.3; // Offset to center tree

  float minDist = 1000.0;
  float minDepth = 0.0;
  float thickness = uThickness / uResolution.y;

  // Generate tree procedurally
  // Using a simplified recursive tree structure
  vec2 pos = vec2(0.0, 0.0);
  float angle = PI / 2.0; // Point up
  float len = 0.15;
  float angleVar = 0.4;

  // Draw trunk
  vec2 end = pos + vec2(cos(angle), sin(angle)) * len;
  float d = sdSegment(uv, pos, end);
  if (d < minDist) { minDist = d; minDepth = 0.0; }

  // Simple recursive branching (unrolled)
  float growth = uSegmentCount / max(1.0, uTotalSegments);

  // Level 1 branches
  if (growth > 0.1) {
    vec2 base = end;
    for (int i = 0; i < 2; i++) {
      float a = angle + (float(i) * 2.0 - 1.0) * angleVar;
      float l = len * 0.7;
      vec2 e = base + vec2(cos(a), sin(a)) * l;
      d = sdSegment(uv, base, e);
      if (d < minDist) { minDist = d; minDepth = 0.2; }

      // Level 2
      if (growth > 0.3) {
        for (int j = 0; j < 2; j++) {
          float a2 = a + (float(j) * 2.0 - 1.0) * angleVar;
          float l2 = l * 0.7;
          vec2 e2 = e + vec2(cos(a2), sin(a2)) * l2;
          d = sdSegment(uv, e, e2);
          if (d < minDist) { minDist = d; minDepth = 0.4; }

          // Level 3
          if (growth > 0.5) {
            for (int k = 0; k < 2; k++) {
              float a3 = a2 + (float(k) * 2.0 - 1.0) * angleVar;
              float l3 = l2 * 0.7;
              vec2 e3 = e2 + vec2(cos(a3), sin(a3)) * l3;
              d = sdSegment(uv, e2, e3);
              if (d < minDist) { minDist = d; minDepth = 0.6; }

              // Level 4
              if (growth > 0.7) {
                for (int m = 0; m < 2; m++) {
                  float a4 = a3 + (float(m) * 2.0 - 1.0) * angleVar;
                  float l4 = l3 * 0.7;
                  vec2 e4 = e3 + vec2(cos(a4), sin(a4)) * l4;
                  d = sdSegment(uv, e3, e4);
                  if (d < minDist) { minDist = d; minDepth = 0.8; }
                }
              }
            }
          }
        }
      }
    }
  }

  // Color based on distance and depth
  float intensity = smoothstep(thickness, 0.0, minDist);
  vec3 col = hsv2rgb(vec3(uHue + minDepth * uDepthColor, 0.7, intensity));

  outColor = vec4(col, 1.0);
}
