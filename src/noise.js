// Simple deterministic noise function using a seed.
// Based on sine pseudorandom generation.
export default function noise(x, seed) {
  const sin = Math.sin(x * seed) * 10000;
  return sin - Math.floor(sin);
}
