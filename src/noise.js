// Basic sine‑based noise used for trivial cases.
export default function noise(x, seed) {
  const sin = Math.sin(x * seed) * 10000;
  return sin - Math.floor(sin);
}

// Mulberry32 PRNG for deterministic permutation tables
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Generate a Perlin noise object with 2D/3D functions
export function createPerlin(seed = 1234) {
  const rng = mulberry32(seed);
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher‑Yates shuffle using the seeded RNG
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];

  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (hash, x, y, z) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  };

  function noise3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);

    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

    return lerp(
      lerp(
        lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
        lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  const noise2 = (x, y) => noise3(x, y, 0);

  return { noise2, noise3 };
}

// Fractal Brownian Motion using any underlying noise3 function
export function fbmNoise3(noiseFn, x, y, z, {
  octaves = 4,
  lacunarity = 2,
  gain = 0.5
} = {}) {
  let value = 0;
  let amp = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noiseFn(x, y, z);
    x *= lacunarity;
    y *= lacunarity;
    z *= lacunarity;
    amp *= gain;
  }
  return value;
}
