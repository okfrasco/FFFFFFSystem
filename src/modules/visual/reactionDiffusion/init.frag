#version 300 es
// Initialize reaction-diffusion with seed pattern
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uSeed;

float hash(vec2 p) {
  return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 center = vec2(0.5);

  // Start with A=1, B=0 everywhere
  float A = 1.0;
  float B = 0.0;

  // Add some initial B in random spots
  vec2 cell = floor(uv * 10.0);
  float h = hash(cell);

  if (h > 0.85) {
    vec2 cellUv = fract(uv * 10.0);
    float d = length(cellUv - 0.5);
    if (d < 0.3) {
      B = 1.0;
    }
  }

  // Also add B in center region
  float d = length(uv - center);
  if (d < 0.1) {
    B = 1.0;
  }

  outColor = vec4(A, B, 0.0, 1.0);
}
