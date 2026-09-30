#version 300 es
// Colore: rotazione di tinta, palette coseno (Iñigo Quilez) mappata sulla
// luminosità, saturazione, contrasto, luminosità e posterize.
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uIn;
uniform float uHue;
uniform float uSaturation;
uniform float uBrightness;
uniform float uContrast;
uniform float uPosterize;
uniform float uPaletteMix;
uniform vec3 uPa;
uniform vec3 uPb;
uniform vec3 uPc;
uniform vec3 uPd;

vec3 hueRotate(vec3 col, float turns) {
  // rotazione nello spazio YIQ
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float a = turns * 6.2831853;
  float c = cos(a), s = sin(a);
  yiq.yz = mat2(c, s, -s, c) * yiq.yz;
  return toRGB * yiq;
}

void main() {
  vec3 col = texture(uIn, vUv).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 pal = uPa + uPb * cos(6.2831853 * (uPc * lum + uPd + uHue));
  col = mix(hueRotate(col, uHue), pal, uPaletteMix);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5 + uBrightness;
  if (uPosterize >= 2.0) col = floor(col * uPosterize + 0.5) / uPosterize;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
