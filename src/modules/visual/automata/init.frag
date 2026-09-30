#version 300 es
// Initialize cellular automata
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uSeed;
uniform float uType;

float hash(vec2 p) {
  return fract(sin(dot(p + uSeed * 0.1, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float cell = 0.0;

  int type = int(uType);

  if (type == 1) {
    // Wolfram 1D: single cell at top center
    vec2 texel = 1.0 / uResolution;
    if (uv.y > 1.0 - texel.y * 2.0 && abs(uv.x - 0.5) < texel.x) {
      cell = 1.0;
    }
  } else {
    // Random initial state for GoL and Brian's Brain
    vec2 gridPos = floor(uv * uResolution);
    float r = hash(gridPos);

    // Sparse initial density
    if (r > 0.7) {
      cell = 1.0;
    }
  }

  outColor = vec4(cell, 0.0, 0.0, 1.0);
}
