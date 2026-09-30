#version 300 es
// Composite blend modes
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMode;
uniform float uOpacity;

vec3 blendMultiply(vec3 a, vec3 b) { return a * b; }
vec3 blendScreen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
vec3 blendOverlay(vec3 a, vec3 b) {
  return vec3(
    a.r < 0.5 ? 2.0 * a.r * b.r : 1.0 - 2.0 * (1.0 - a.r) * (1.0 - b.r),
    a.g < 0.5 ? 2.0 * a.g * b.g : 1.0 - 2.0 * (1.0 - a.g) * (1.0 - b.g),
    a.b < 0.5 ? 2.0 * a.b * b.b : 1.0 - 2.0 * (1.0 - a.b) * (1.0 - b.b)
  );
}
vec3 blendDarken(vec3 a, vec3 b) { return min(a, b); }
vec3 blendLighten(vec3 a, vec3 b) { return max(a, b); }
vec3 blendDifference(vec3 a, vec3 b) { return abs(a - b); }
vec3 blendAdd(vec3 a, vec3 b) { return min(a + b, 1.0); }
vec3 blendSubtract(vec3 a, vec3 b) { return max(a - b, 0.0); }
vec3 blendDivide(vec3 a, vec3 b) { return a / max(b, 0.001); }

void main() {
  vec4 a = texture(uA, vUv);
  vec4 b = texture(uB, vUv);

  int mode = int(uMode);
  vec3 result;

  if (mode == 0) result = b.rgb; // Normal
  else if (mode == 1) result = blendMultiply(a.rgb, b.rgb);
  else if (mode == 2) result = blendScreen(a.rgb, b.rgb);
  else if (mode == 3) result = blendOverlay(a.rgb, b.rgb);
  else if (mode == 4) result = blendDarken(a.rgb, b.rgb);
  else if (mode == 5) result = blendLighten(a.rgb, b.rgb);
  else if (mode == 6) result = blendDifference(a.rgb, b.rgb);
  else if (mode == 7) result = blendAdd(a.rgb, b.rgb);
  else if (mode == 8) result = blendSubtract(a.rgb, b.rgb);
  else result = blendDivide(a.rgb, b.rgb);

  // Apply opacity
  result = mix(a.rgb, result, uOpacity);

  outColor = vec4(result, 1.0);
}
