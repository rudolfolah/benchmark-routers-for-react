#!/usr/bin/env node

const { performance } = require('node:perf_hooks');
const { loadRouters, ROUTE_PATHS } = require('./src/routers');

const SCENARIOS = {
  'static-first': '/a',
  'static-middle': '/m',
  'static-last': '/z',
  dynamic: '/users/42',
  'not-found': '/does-not-exist',
};

function usage() {
  return `Usage: node index.js [options]

Options:
  --routers <ids>     Comma-separated router IDs (default: all)
  --scenarios <names> Comma-separated scenario names (default: all)
  --runs <number>     Timed matches per sample (default: 10000)
  --samples <number>  Number of samples (default: 5)
  --warmup <number>   Untimed warm-up matches (default: 10000)
  --format <table|json|csv> Output format (default: table)
  --list              List available routers and scenarios
  --help              Show this message

Example:
  npm start -- --routers react-router-v7,tanstack-router-v1 --runs 25000`;
}

function parsePositiveInteger(value, option) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return number;
}

function parseArgs(argv) {
  const options = {
    routers: null,
    scenarios: null,
    runs: 10000,
    samples: 5,
    warmup: 10000,
    format: 'table',
    list: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help' || option === '-h') options.help = true;
    else if (option === '--list') options.list = true;
    else if (['--routers', '--scenarios', '--runs', '--samples', '--warmup', '--format'].includes(option)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
      index += 1;
      if (option === '--routers') options.routers = value.split(',').filter(Boolean);
      else if (option === '--scenarios') options.scenarios = value.split(',').filter(Boolean);
      else if (option === '--format') options.format = value;
      else options[option.slice(2)] = parsePositiveInteger(value, option);
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  if (!['table', 'json', 'csv'].includes(options.format)) {
    throw new Error('--format must be table, json, or csv');
  }
  return options;
}

function select(items, requested, kind) {
  if (!requested) return items;
  const available = new Map(items.map((item) => [item.id || item, item]));
  const unknown = requested.filter((id) => !available.has(id));
  if (unknown.length) throw new Error(`Unknown ${kind}: ${unknown.join(', ')}`);
  return requested.map((id) => available.get(id));
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function benchmark(router, scenario, options) {
  const path = SCENARIOS[scenario];
  for (let index = 0; index < options.warmup; index += 1) router.match(path);

  const samples = [];
  let matches = 0;
  for (let sample = 0; sample < options.samples; sample += 1) {
    const start = performance.now();
    for (let index = 0; index < options.runs; index += 1) {
      if (router.match(path)) matches += 1;
    }
    samples.push(performance.now() - start);
  }

  const expectedMatches = scenario === 'not-found' ? 0 : options.runs * options.samples;
  if (matches !== expectedMatches) {
    throw new Error(`${router.id} returned an unexpected result for ${scenario}`);
  }

  const medianMs = percentile(samples, 0.5);
  return {
    router: router.id,
    package: router.package,
    version: router.version,
    scenario,
    routes: ROUTE_PATHS.length,
    runsPerSample: options.runs,
    samples: options.samples,
    medianMs: Number(medianMs.toFixed(3)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(3)),
    opsPerSecond: Math.round(options.runs / (medianMs / 1000)),
  };
}

function print(results, format) {
  if (format === 'json') return console.log(JSON.stringify(results, null, 2));
  if (format === 'csv') {
    const keys = Object.keys(results[0]);
    console.log(keys.join(','));
    for (const result of results) console.log(keys.map((key) => result[key]).join(','));
    return;
  }
  console.table(results.map(({ router, version, scenario, medianMs, p95Ms, opsPerSecond }) => ({
    router,
    version,
    scenario,
    'median (ms)': medianMs,
    'p95 (ms)': p95Ms,
    'ops/sec': opsPerSecond,
  })));
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return console.log(usage());

  const routers = await loadRouters();
  if (options.list) {
    console.log('Routers:');
    for (const router of routers) console.log(`  ${router.id} (${router.package} ${router.version})`);
    console.log(`Scenarios:\n  ${Object.keys(SCENARIOS).join('\n  ')}`);
    return;
  }

  const selectedRouters = select(routers, options.routers, 'router');
  const selectedScenarios = select(Object.keys(SCENARIOS), options.scenarios, 'scenario');
  const results = [];
  for (const router of selectedRouters) {
    for (const scenario of selectedScenarios) results.push(benchmark(router, scenario, options));
  }
  print(results, options.format);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { SCENARIOS, benchmark, parseArgs, select };
