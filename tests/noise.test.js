import noise from '../src/noise.js';
import assert from 'assert/strict';
import { test } from 'node:test';

test('noise returns consistent values for same seed', () => {
  const seed = 42;
  const input = 1.2345;
  const first = noise(input, seed);
  const second = noise(input, seed);
  assert.equal(first, second);
});
