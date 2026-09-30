#version 300 es
// Time echo — combine multiple frames
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform sampler2D uFrame0;
uniform sampler2D uFrame1;
uniform sampler2D uFrame2;
uniform sampler2D uFrame3;
uniform float uNumFrames;
uniform float uMode;
uniform float uDecay;
uniform float uMix;
uniform float uWriteIdx;

void main() {
  vec4 current = texture(uIn, vUv);
  vec4 f0 = texture(uFrame0, vUv);
  vec4 f1 = texture(uFrame1, vUv);
  vec4 f2 = texture(uFrame2, vUv);
  vec4 f3 = texture(uFrame3, vUv);

  int mode = int(uMode);
  int numFrames = int(uNumFrames);

  vec4 result = vec4(0.0);

  if (mode == 0) {
    // Sum with decay
    float weight = 1.0;
    float totalWeight = 0.0;
    vec4 sum = current;
    totalWeight += weight;

    if (numFrames > 0) { weight *= uDecay; sum += f0 * weight; totalWeight += weight; }
    if (numFrames > 1) { weight *= uDecay; sum += f1 * weight; totalWeight += weight; }
    if (numFrames > 2) { weight *= uDecay; sum += f2 * weight; totalWeight += weight; }
    if (numFrames > 3) { weight *= uDecay; sum += f3 * weight; totalWeight += weight; }

    result = sum / totalWeight;

  } else if (mode == 1) {
    // Difference from oldest
    vec4 oldest = numFrames > 3 ? f3 : (numFrames > 2 ? f2 : (numFrames > 1 ? f1 : f0));
    result = abs(current - oldest);

  } else if (mode == 2) {
    // Max (lighten)
    result = current;
    if (numFrames > 0) result = max(result, f0 * uDecay);
    if (numFrames > 1) result = max(result, f1 * uDecay * uDecay);
    if (numFrames > 2) result = max(result, f2 * uDecay * uDecay * uDecay);
    if (numFrames > 3) result = max(result, f3 * pow(uDecay, 4.0));

  } else {
    // Trail effect
    vec4 trail = f0;
    if (numFrames > 1) trail = max(trail * uDecay, f1);
    if (numFrames > 2) trail = max(trail * uDecay, f2);
    if (numFrames > 3) trail = max(trail * uDecay, f3);
    result = max(current, trail * uDecay);
  }

  outColor = mix(current, result, uMix);
}
