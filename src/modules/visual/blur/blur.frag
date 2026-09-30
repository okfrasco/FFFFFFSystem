#version 300 es
// Gaussian blur — single pass (horizontal or vertical)
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform vec2 uDirection;
uniform float uRadius;

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 sum = vec4(0.0);
  float total = 0.0;

  // 9-tap gaussian approximation
  float weights[9] = float[](0.0162162, 0.0540540, 0.1216216, 0.1945945, 0.2270270,
                             0.1945945, 0.1216216, 0.0540540, 0.0162162);

  for (int i = 0; i < 9; i++) {
    float offset = float(i - 4);
    vec2 samplePos = vUv + uDirection * texel * offset * uRadius * 0.5;
    sum += texture(uIn, samplePos) * weights[i];
    total += weights[i];
  }

  outColor = sum / total;
}
