#version 300 es
// Mask — use one texture to mask another
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform sampler2D uMask;
uniform float uChannel;
uniform float uInvert;
uniform float uThreshold;
uniform float uSoftness;
uniform float uMultiply;

void main() {
  vec4 input = texture(uIn, vUv);
  vec4 maskTex = texture(uMask, vUv);

  int channel = int(uChannel);
  float maskVal;

  if (channel == 0) {
    // Luminance
    maskVal = dot(maskTex.rgb, vec3(0.299, 0.587, 0.114));
  } else if (channel == 1) {
    maskVal = maskTex.r;
  } else if (channel == 2) {
    maskVal = maskTex.g;
  } else {
    maskVal = maskTex.b;
  }

  if (uInvert > 0.5) maskVal = 1.0 - maskVal;

  // Apply threshold with softness
  if (uSoftness > 0.001) {
    maskVal = smoothstep(uThreshold, uThreshold + uSoftness, maskVal);
  } else {
    maskVal = step(uThreshold, maskVal);
  }

  vec4 result;
  if (uMultiply > 0.5) {
    // Multiply mode
    result = vec4(input.rgb * maskVal, input.a);
  } else {
    // Alpha mask mode
    result = vec4(input.rgb, input.a * maskVal);
  }

  outColor = result;
}
