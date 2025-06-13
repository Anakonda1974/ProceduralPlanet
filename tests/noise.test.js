const noise = require('../src/noise');

test('noise returns consistent values for same seed', () => {
  const seed = 42;
  const input = 1.2345;
  const first = noise(input, seed);
  const second = noise(input, seed);
  expect(first).toBe(second);
});
