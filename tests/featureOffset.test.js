import { createPerlin, getFeatureFactor } from '../src/noise.js';
import assert from 'assert/strict';
import { test } from 'node:test';

test('getFeatureFactor is deterministic for same inputs', () => {
  const perlin = createPerlin(123);
  const v1 = getFeatureFactor(perlin, 42, 'layer', 0, 'radius');
  const v2 = getFeatureFactor(perlin, 42, 'layer', 0, 'radius');
  assert.equal(v1, v2);
});

test('different parameter tag results in different values', () => {
  const perlin = createPerlin(123);
  const v1 = getFeatureFactor(perlin, 42, 'layer', 0, 'a');
  const v2 = getFeatureFactor(perlin, 42, 'layer', 0, 'b');
  assert.notEqual(v1, v2);
});
