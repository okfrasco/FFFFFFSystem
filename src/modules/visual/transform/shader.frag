#version 300 es
// Transform: zoom, rotazione, kaleidoscopio, tile e specchi sulle coordinate.
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform float uZoom;
uniform float uAngle;
uniform float uSegments;
uniform float uTile;
uniform float uMirrorX;
uniform float uMirrorY;
uniform vec2 uOffset;

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  if (uMirrorX > 0.5) p.x = abs(p.x);
  if (uMirrorY > 0.5) p.y = abs(p.y);
  float c = cos(uAngle), s = sin(uAngle);
  p = mat2(c, -s, s, c) * p / uZoom;
  if (uSegments >= 2.0) {
    // kaleidoscopio: l'angolo ripiegato in un solo spicchio, specchiato
    float seg = 6.2831853 / uSegments;
    float a = atan(p.y, p.x);
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    p = vec2(cos(a), sin(a)) * length(p);
  }
  vec2 uv = p / vec2(aspect, 1.0) + 0.5 + uOffset;
  uv = uTile > 1.0 ? fract(uv * uTile) : uv;
  // fuori dall'immagine: specchiata, così non ci sono bordi vuoti
  uv = 1.0 - abs(1.0 - mod(uv, 2.0));
  outColor = vec4(texture(uIn, uv).rgb, 1.0);
}
