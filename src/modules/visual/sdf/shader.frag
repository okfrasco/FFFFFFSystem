#version 300 es
// SDF raymarching con forme 3D combinabili
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uShape;
uniform float uCombine;
uniform float uSize;
uniform float uRound;
uniform float uRepeat;
uniform float uTwist;
uniform float uCamDist;
uniform float uAmbient;
uniform float uSpecular;
uniform float uHue;
uniform float uSeed;

#define PI 3.14159265359
#define MAX_STEPS 64
#define MAX_DIST 20.0
#define SURF_DIST 0.001

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// SDF primitives
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCapsule(vec3 p, float h, float r) { p.y -= clamp(p.y, 0.0, h); return length(p) - r; }
float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));
}
float sdGyroid(vec3 p, float scale, float thickness) {
  p *= scale;
  return abs(dot(sin(p), cos(p.zxy))) / scale - thickness;
}

// Operations
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
float opSmoothSub(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d1, -d2, h) + k * h * (1.0 - h);
}
float opSmoothInt(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) + k * h * (1.0 - h);
}

vec3 opRep(vec3 p, float c) {
  return c > 0.01 ? mod(p + 0.5 * c, c) - 0.5 * c : p;
}

vec3 opTwist(vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xz, p.y);
}

float getShape(vec3 p, int shape, float size) {
  if (shape == 0) return sdSphere(p, size);
  if (shape == 1) return sdBox(p, vec3(size * 0.8)) - uRound;
  if (shape == 2) return sdTorus(p, vec2(size, size * 0.3));
  if (shape == 3) return sdCapsule(p - vec3(0, -size * 0.5, 0), size, size * 0.3);
  if (shape == 4) return sdOctahedron(p, size) - uRound;
  return sdGyroid(p, 3.0 / size, 0.03 + uRound * 0.5);
}

float scene(vec3 p) {
  // Apply twist
  if (uTwist > 0.01) p = opTwist(p, uTwist);

  // Apply repetition
  vec3 q = opRep(p, uRepeat);

  int shape = int(uShape);
  int combine = int(uCombine);

  float d1 = getShape(q, shape, uSize);

  // Second shape for combinations
  float d2 = sdSphere(q - vec3(uSize * 0.7, 0.0, 0.0), uSize * 0.5);

  float k = 0.2 + uRound;
  if (combine == 0) return d1;
  if (combine == 1) return opSmoothInt(d1, d2, k);
  if (combine == 2) return opSmoothSub(d1, d2, k);
  return opSmoothUnion(d1, d2, k);
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

float rayMarch(vec3 ro, vec3 rd) {
  float d = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * d;
    float ds = scene(p);
    d += ds;
    if (ds < SURF_DIST || d > MAX_DIST) break;
  }
  return d;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  // Camera rotation with time
  float t = uTime * PI * 2.0 + uSeed * PI * 2.0;
  vec3 ro = vec3(sin(t) * uCamDist, 2.0, cos(t) * uCamDist);
  vec3 lookAt = vec3(0.0);

  // Camera matrix
  vec3 f = normalize(lookAt - ro);
  vec3 r = normalize(cross(vec3(0, 1, 0), f));
  vec3 u = cross(f, r);
  vec3 rd = normalize(uv.x * r + uv.y * u + 1.5 * f);

  float d = rayMarch(ro, rd);

  vec3 col = vec3(0.02);

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p);

    // Lighting
    vec3 lightPos = vec3(3.0, 5.0, 4.0);
    vec3 lightDir = normalize(lightPos - p);

    float diff = max(dot(n, lightDir), 0.0);
    float amb = uAmbient;

    // Specular
    vec3 viewDir = normalize(ro - p);
    vec3 reflDir = reflect(-lightDir, n);
    float spec = pow(max(dot(viewDir, reflDir), 0.0), 32.0) * uSpecular;

    // Fresnel rim
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

    vec3 baseCol = hsv2rgb(vec3(uHue + n.y * 0.1, 0.7, 0.9));
    col = baseCol * (amb + diff) + vec3(spec) + fresnel * 0.2;

    // AO approximation
    float ao = 0.5 + 0.5 * n.y;
    col *= ao;
  }

  // Gamma
  col = pow(col, vec3(0.4545));

  outColor = vec4(col, 1.0);
}
