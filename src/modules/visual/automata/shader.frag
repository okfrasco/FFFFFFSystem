#version 300 es
// Cellular automata — Game of Life, Wolfram 1D, Brian's Brain
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform sampler2D uState;
uniform float uType;
uniform float uRule;
uniform float uWrap;
uniform float uHue;
uniform float uFade;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec2 wrap(vec2 uv) {
  if (uWrap > 0.5) return fract(uv);
  return clamp(uv, 0.0, 1.0);
}

float getCell(vec2 offset) {
  vec2 texel = 1.0 / uResolution;
  vec2 uv = wrap(vUv + offset * texel);
  return texture(uState, uv).r;
}

void main() {
  vec2 texel = 1.0 / uResolution;
  float current = texture(uState, vUv).r;
  float age = texture(uState, vUv).g;

  int type = int(uType);
  float next = 0.0;

  if (type == 0) {
    // Game of Life
    float neighbors = 0.0;
    neighbors += getCell(vec2(-1.0, -1.0));
    neighbors += getCell(vec2(0.0, -1.0));
    neighbors += getCell(vec2(1.0, -1.0));
    neighbors += getCell(vec2(-1.0, 0.0));
    neighbors += getCell(vec2(1.0, 0.0));
    neighbors += getCell(vec2(-1.0, 1.0));
    neighbors += getCell(vec2(0.0, 1.0));
    neighbors += getCell(vec2(1.0, 1.0));

    // B3/S23 rules
    if (current > 0.5) {
      next = (neighbors >= 2.0 && neighbors <= 3.0) ? 1.0 : 0.0;
    } else {
      next = (neighbors >= 2.5 && neighbors <= 3.5) ? 1.0 : 0.0;
    }
  } else if (type == 1) {
    // Wolfram 1D elementary automaton
    // Only update top row, shift down
    if (vUv.y > 1.0 - texel.y * 2.0) {
      // Top row: apply rule
      float l = getCell(vec2(-1.0, 0.0));
      float c = current;
      float r = getCell(vec2(1.0, 0.0));
      int pattern = int(l * 4.0 + c * 2.0 + r);
      int rule = int(uRule);
      next = ((rule >> pattern) & 1) == 1 ? 1.0 : 0.0;
    } else {
      // Copy from row above
      next = getCell(vec2(0.0, 1.0));
    }
  } else {
    // Brian's Brain (3 states: off=0, on=1, dying=0.5)
    float neighbors = 0.0;
    for (float y = -1.0; y <= 1.0; y++) {
      for (float x = -1.0; x <= 1.0; x++) {
        if (x != 0.0 || y != 0.0) {
          float n = getCell(vec2(x, y));
          if (n > 0.75) neighbors += 1.0; // only count fully on
        }
      }
    }

    if (current > 0.75) {
      // On -> Dying
      next = 0.5;
    } else if (current > 0.25) {
      // Dying -> Off
      next = 0.0;
    } else {
      // Off -> On if exactly 2 neighbors
      next = (neighbors >= 1.5 && neighbors <= 2.5) ? 1.0 : 0.0;
    }
  }

  // Age tracking for color
  float newAge = next > 0.5 ? min(age + 0.02, 1.0) : age * uFade;

  // Colorize
  vec3 col = vec3(0.0);
  if (next > 0.5) {
    col = hsv2rgb(vec3(uHue + newAge * 0.3, 0.8, 1.0));
  } else if (next > 0.25) {
    // Dying state (Brian's Brain)
    col = hsv2rgb(vec3(uHue + 0.5, 0.5, 0.5));
  } else if (uFade > 0.01) {
    col = hsv2rgb(vec3(uHue, 0.3, newAge * 0.5));
  }

  outColor = vec4(next, newAge, col.b, 1.0);
}
