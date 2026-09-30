/**
 * FFT complessa radix-2 in place (n potenza di 2), per le tavole d'onda e gli
 * effetti spettrali. `inverse` scala per 1/n.
 */

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

function plan(n: number) {
  let p = twiddles.get(n);
  if (p) return p;
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  p = { cos, sin, rev };
  twiddles.set(n, p);
  return p;
}

export function fft(re: Float64Array | Float32Array, im: Float64Array | Float32Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error('fft: la lunghezza deve essere una potenza di 2');
  const { cos, sin, rev } = plan(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i]!;
    if (j > i) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const c = cos[k * step]!;
        const s = sign * sin[k * step]!;
        const a = start + k;
        const b = a + half;
        const xr = re[b]! * c - im[b]! * s;
        const xi = re[b]! * s + im[b]! * c;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] = re[i]! / n;
      im[i] = im[i]! / n;
    }
  }
}

/** Un ciclo d'onda di `n` campioni da ampiezze (seno) per armonica: amps[k] = armonica k+1. */
export function additiveCycle(amps: ArrayLike<number>, n: number, phases?: ArrayLike<number>): Float32Array {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < amps.length && k + 1 < n / 2; k++) {
    const a = amps[k] ?? 0;
    if (!a) continue;
    const ph = phases?.[k] ?? 0;
    // sin(2π(k+1)t + ph): coefficiente −i/2 · e^{i ph} sul bin k+1 e coniugato sul simmetrico
    re[k + 1] = (a / 2) * Math.sin(ph) * n;
    im[k + 1] = (-a / 2) * Math.cos(ph) * n;
    re[n - k - 1] = re[k + 1]!;
    im[n - k - 1] = -im[k + 1]!;
  }
  fft(re, im, true);
  return Float32Array.from(re);
}
