#version 300 es
// Feedback: il frame precedente, trasformato (zoom, rotazione, spostamento),
// si fonde con l'ingresso. Modo 0 = mix, 1 = max, 2 = somma.
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uIn;
uniform sampler2D uPrev;
uniform float uAmount;
uniform float uZoom;
uniform float uRotate;
uniform vec2 uShift;
uniform float uMode;

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float c = cos(uRotate), s = sin(uRotate);
  p = mat2(c, -s, s, c) * p / uZoom;
  vec2 uv = p / vec2(aspect, 1.0) + 0.5 - uShift;
  vec3 prev = texture(uPrev, uv).rgb;
  vec3 inp = texture(uIn, vUv).rgb;
  vec3 col;
  if (uMode < 0.5) col = mix(inp, prev, uAmount);
  else if (uMode < 1.5) col = max(inp, prev * uAmount);
  else col = inp + prev * uAmount;
  outColor = vec4(clamp(col, 0.0, 4.0), 1.0);
}
