#version 300 es
// Gray-Scott reaction-diffusion
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uState;
uniform float uFeed;
uniform float uKill;
uniform float uDiffA;
uniform float uDiffB;
uniform float uHue;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 texel = 1.0 / uResolution;

  // Sample current state and neighbors (Laplacian with 9-point stencil)
  vec2 c = texture(uState, vUv).rg;
  vec2 l = texture(uState, vUv + vec2(-texel.x, 0.0)).rg;
  vec2 r = texture(uState, vUv + vec2(texel.x, 0.0)).rg;
  vec2 t = texture(uState, vUv + vec2(0.0, texel.y)).rg;
  vec2 b = texture(uState, vUv + vec2(0.0, -texel.y)).rg;
  vec2 tl = texture(uState, vUv + vec2(-texel.x, texel.y)).rg;
  vec2 tr = texture(uState, vUv + vec2(texel.x, texel.y)).rg;
  vec2 bl = texture(uState, vUv + vec2(-texel.x, -texel.y)).rg;
  vec2 br = texture(uState, vUv + vec2(texel.x, -texel.y)).rg;

  // Laplacian (weighted)
  vec2 laplacian = (l + r + t + b) * 0.2 + (tl + tr + bl + br) * 0.05 - c;

  float A = c.r;
  float B = c.g;

  // Gray-Scott equations
  float reaction = A * B * B;
  float dA = uDiffA * laplacian.r - reaction + uFeed * (1.0 - A);
  float dB = uDiffB * laplacian.g + reaction - (uKill + uFeed) * B;

  A = clamp(A + dA, 0.0, 1.0);
  B = clamp(B + dB, 0.0, 1.0);

  // Visualize B concentration with color
  vec3 col = hsv2rgb(vec3(uHue + B * 0.3, 0.7, B));

  outColor = vec4(A, B, col.b, 1.0);
}
