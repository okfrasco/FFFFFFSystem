/**
 * Utilità WebGL2 per i nodi visual: programmi a triangolo che copre lo
 * schermo, render target (RGBA16F se disponibile, così il feedback non si
 * sgrana), passaggi con uniform e texture.
 */

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

const floatOk = new WeakMap<WebGL2RenderingContext, boolean>();

function supportsFloat(gl: WebGL2RenderingContext): boolean {
  let ok = floatOk.get(gl);
  if (ok === undefined) {
    ok = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    floatOk.set(gl, ok);
  }
  return ok;
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number, float = true): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (float && supportsFloat(gl)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target | null): void {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

export class Pass {
  readonly program: WebGLProgram;
  private readonly locs = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    fragment: string,
  ) {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`programma: ${gl.getProgramInfoLog(p)}`);
    this.program = p;
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.program, name));
    return this.locs.get(name)!;
  }

  /**
   * Disegna nel target (null = schermo). `uniforms`: numeri o vettori;
   * `textures`: nome del sampler → texture (unità in ordine).
   */
  draw(
    target: Target | null,
    uniforms: Record<string, number | readonly number[]>,
    textures: Record<string, WebGLTexture | null> = {},
    size?: { width: number; height: number },
  ): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo ?? null);
    const w = target?.width ?? size?.width ?? gl.drawingBufferWidth;
    const h = target?.height ?? size?.height ?? gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.loc('uResolution'), w, h);
    for (const [name, v] of Object.entries(uniforms)) {
      const l = this.loc(name);
      if (!l) continue;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0]!, v[1]!);
      else if (v.length === 3) gl.uniform3f(l, v[0]!, v[1]!, v[2]!);
      else if (v.length === 4) gl.uniform4f(l, v[0]!, v[1]!, v[2]!, v[3]!);
    }
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.loc(name), unit);
      unit++;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

/** Dimensione dei render target: quella del canvas per la scala di rendering. */
export function targetSize(gl: WebGL2RenderingContext): { width: number; height: number } {
  return { width: Math.max(1, gl.drawingBufferWidth), height: Math.max(1, gl.drawingBufferHeight) };
}
