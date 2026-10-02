const assert = require('node:assert/strict');
const test = require('node:test');

const { SCENARIOS, benchmark, parseArgs, select } = require('../index');
const { loadRouters } = require('../src/routers');

test('all adapters agree on benchmark paths', async () => {
  const routers = await loadRouters();
  for (const router of routers) {
    for (const [scenario, { pathname, expected }] of Object.entries(SCENARIOS)) {
      assert.equal(router.match(pathname), expected, `${router.id}: ${scenario}`);
    }
  }
});

test('arguments select routers and configure run sizes', () => {
  const options = parseArgs([
    '--routers', 'react-router-v7,wouter-v3',
    '--scenarios', 'dynamic,not-found',
    '--runs', '20',
    '--samples', '2',
    '--warmup', '5',
    '--format', 'json',
  ]);
  assert.deepEqual(options.routers, ['react-router-v7', 'wouter-v3']);
  assert.deepEqual(options.scenarios, ['dynamic', 'not-found']);
  assert.equal(options.runs, 20);
  assert.equal(options.samples, 2);
  assert.equal(options.warmup, 5);
  assert.equal(options.format, 'json');
});

test('invalid options produce useful errors', () => {
  assert.throws(() => parseArgs(['--runs', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--format', 'xml']), /table, json, or csv/);
  assert.throws(() => select(['one'], ['two'], 'scenario'), /Unknown scenario: two/);
});

test('benchmark returns structured results', () => {
  const result = benchmark(
    { id: 'stub', package: 'stub', version: '1.0.0', match: () => true },
    'static-first',
    { runs: 10, samples: 2, warmup: 2 },
  );
  assert.equal(result.router, 'stub');
  assert.equal(result.runsPerSample, 10);
  assert.equal(result.samples, 2);
  assert.ok(result.opsPerSecond > 0);
});
