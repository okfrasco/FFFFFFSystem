#version 300 es
// Edge detection — Sobel, Laplacian, Frei-Chen
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform float uMode;
uniform float uThreshold;
uniform float uStrength;
uniform float uInvert;
uniform float uOverlay;
uniform float uHue;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 original = texture(uIn, vUv);

  // Sample 3x3 neighborhood
  float tl = luminance(texture(uIn, vUv + vec2(-texel.x, texel.y)).rgb);
  float t  = luminance(texture(uIn, vUv + vec2(0.0, texel.y)).rgb);
  float tr = luminance(texture(uIn, vUv + vec2(texel.x, texel.y)).rgb);
  float l  = luminance(texture(uIn, vUv + vec2(-texel.x, 0.0)).rgb);
  float c  = luminance(original.rgb);
  float r  = luminance(texture(uIn, vUv + vec2(texel.x, 0.0)).rgb);
  float bl = luminance(texture(uIn, vUv + vec2(-texel.x, -texel.y)).rgb);
  float b  = luminance(texture(uIn, vUv + vec2(0.0, -texel.y)).rgb);
  float br = luminance(texture(uIn, vUv + vec2(texel.x, -texel.y)).rgb);

  float edge = 0.0;
  int mode = int(uMode);

  if (mode == 0) {
    // Sobel
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    edge = sqrt(gx*gx + gy*gy);
  } else if (mode == 1) {
    // Laplacian
    edge = abs(8.0*c - tl - t - tr - l - r - bl - b - br);
  } else {
    // Frei-Chen (edge response normalized)
    float gx = (tl + sqrt(2.0)*l + bl - tr - sqrt(2.0)*r - br) / (2.0 + sqrt(2.0));
    float gy = (tl + sqrt(2.0)*t + tr - bl - sqrt(2.0)*b - br) / (2.0 + sqrt(2.0));
    edge = sqrt(gx*gx + gy*gy);
  }

  edge *= uStrength;
  edge = smoothstep(uThreshold, uThreshold + 0.1, edge);

  if (uInvert > 0.5) edge = 1.0 - edge;

  vec3 edgeColor;
  if (uHue < 0.01) {
    edgeColor = vec3(edge);
  } else {
    edgeColor = hsv2rgb(vec3(uHue, 0.8, edge));
  }

  vec3 result = mix(edgeColor, original.rgb + edgeColor * 0.5, uOverlay);

  outColor = vec4(result, 1.0);
}
