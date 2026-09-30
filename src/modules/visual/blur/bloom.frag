#version 300 es
// Bloom combine — add blurred bright areas to original
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform sampler2D uBlur;
uniform float uThreshold;
uniform float uIntensity;

void main() {
  vec4 original = texture(uIn, vUv);
  vec4 blurred = texture(uBlur, vUv);

  // Extract bright areas
  float brightness = dot(blurred.rgb, vec3(0.299, 0.587, 0.114));
  float contribution = smoothstep(uThreshold, uThreshold + 0.1, brightness);

  vec3 bloom = blurred.rgb * contribution * uIntensity;

  outColor = vec4(original.rgb + bloom, original.a);
}
