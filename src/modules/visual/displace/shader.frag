#version 300 es
// Displace — pixel displacement based on map texture
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform sampler2D uMap;
uniform float uAmount;
uniform float uScaleX;
uniform float uScaleY;
uniform float uMode;
uniform float uWrap;

#define PI 3.14159265359

vec2 wrapCoord(vec2 uv) {
  if (uWrap > 0.5) return fract(uv);
  return clamp(uv, 0.0, 1.0);
}

void main() {
  vec4 mapSample = texture(uMap, vUv);
  vec2 displacement;

  int mode = int(uMode);

  if (mode == 0) {
    // RG mode: R = X displacement, G = Y displacement
    displacement = (mapSample.rg - 0.5) * 2.0;
  } else if (mode == 1) {
    // Luminance mode: displacement in both directions based on brightness
    float lum = dot(mapSample.rgb, vec3(0.299, 0.587, 0.114));
    displacement = vec2(lum - 0.5) * 2.0;
  } else {
    // Angular mode: luminance determines angle, RG difference determines magnitude
    float lum = dot(mapSample.rgb, vec3(0.299, 0.587, 0.114));
    float angle = lum * PI * 2.0;
    float mag = length(mapSample.rg - 0.5);
    displacement = vec2(cos(angle), sin(angle)) * mag * 2.0;
  }

  displacement *= vec2(uScaleX, uScaleY) * uAmount;

  vec2 sampleUv = wrapCoord(vUv + displacement);
  vec4 col = texture(uIn, sampleUv);

  outColor = col;
}
