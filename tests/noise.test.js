import noise, { createPerlin } from '../src/noise.js';
import assert from 'assert/strict';
import { test } from 'node:test';

test('noise returns consistent values for same seed', () => {
  const seed = 42;
  const input = 1.2345;
  const first = noise(input, seed);
  const second = noise(input, seed);
  assert.equal(first, second);
});

test('perlin noise is deterministic for identical seeds', () => {
  const p1 = createPerlin(99);
  const p2 = createPerlin(99);
  const val1 = p1.noise3(0.1, 0.2, 0.3);
  const val2 = p2.noise3(0.1, 0.2, 0.3);
  assert.equal(val1, val2);
});
