#version 300 es
// Copia una texture sullo schermo.
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uIn;
void main() { outColor = vec4(texture(uIn, vUv).rgb, 1.0); }
