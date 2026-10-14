/* global AbortSignal, URL, console, fetch, process */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

const baseUrl = requiredUrl(process.env.PERF_BASE_URL ?? process.env.BASE_URL);
const endpoints = parseEndpoints(process.env.PERF_ENDPOINTS ?? '/health/live');
const requestCount = positiveInteger(process.env.PERF_REQUESTS, 100, 'PERF_REQUESTS');
const concurrency = positiveInteger(process.env.PERF_CONCURRENCY, 10, 'PERF_CONCURRENCY');
const timeoutMs = positiveInteger(process.env.PERF_TIMEOUT_MS, 2_000, 'PERF_TIMEOUT_MS');
const latencyBudgetMs = positiveNumber(
  process.env.PERF_P95_BUDGET_MS ?? process.env.API_P95_BUDGET_MS,
  750,
  'PERF_P95_BUDGET_MS',
);
const errorBudgetPercent = positiveNumber(
  process.env.PERF_ERROR_RATE_BUDGET_PERCENT ?? process.env.ERROR_RATE_BUDGET_PERCENT,
  1,
  'PERF_ERROR_RATE_BUDGET_PERCENT',
);
const outputPath = process.env.PERF_OUTPUT?.trim();

const results = new Array(requestCount);
let nextIndex = 0;
const workerCount = Math.min(concurrency, requestCount);

await Promise.all(
  Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= requestCount) return;
      const endpoint = endpoints[index % endpoints.length];
      results[index] = await measureRequest(endpoint);
    }
  }),
);

const summary = summarize(results);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: redactBaseUrl(baseUrl),
  requests: requestCount,
  concurrency: workerCount,
  timeoutMs,
  budgets: {
    p95Ms: latencyBudgetMs,
    errorRatePercent: errorBudgetPercent,
  },
  ...summary,
};

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report));

if (summary.p95Ms > latencyBudgetMs || summary.errorRatePercent > errorBudgetPercent) {
  console.error(
    `Performance budget exceeded: p95=${summary.p95Ms}ms (budget ${latencyBudgetMs}ms), ` +
      `errors=${summary.errorRatePercent}% (budget ${errorBudgetPercent}%)`,
  );
  process.exitCode = 1;
}

async function measureRequest(endpoint) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(endpoint, baseUrl), {
      headers: authorizationHeader(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    return {
      endpoint,
      latencyMs: round(performance.now() - started),
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
    };
  } catch (error) {
    return {
      endpoint,
      latencyMs: round(performance.now() - started),
      ok: false,
      status: null,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

function summarize(resultsToSummarize) {
  const latencies = resultsToSummarize.map((result) => result.latencyMs).sort((a, b) => a - b);
  const failures = resultsToSummarize.filter((result) => !result.ok).length;
  const byEndpoint = Object.fromEntries(
    endpoints.map((endpoint) => {
      const endpointResults = resultsToSummarize.filter((result) => result.endpoint === endpoint);
      const endpointLatencies = endpointResults
        .map((result) => result.latencyMs)
        .sort((a, b) => a - b);
      return [
        endpoint,
        {
          requests: endpointResults.length,
          errors: endpointResults.filter((result) => !result.ok).length,
          p50Ms: percentile(endpointLatencies, 0.5),
          p95Ms: percentile(endpointLatencies, 0.95),
          p99Ms: percentile(endpointLatencies, 0.99),
        },
      ];
    }),
  );

  return {
    errors: failures,
    errorRatePercent: round((failures / resultsToSummarize.length) * 100),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    byEndpoint,
  };
}

function authorizationHeader() {
  const token = process.env.PERF_AUTHORIZATION?.trim();
  return token ? { authorization: token } : {};
}

function parseEndpoints(value) {
  const parsed = value
    .split(',')
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);
  if (!parsed.length) throw new Error('PERF_ENDPOINTS must contain at least one path');
  return parsed;
}

function requiredUrl(value) {
  if (!value) throw new Error('PERF_BASE_URL is required');
  try {
    return new URL(value.endsWith('/') ? value : `${value}/`);
  } catch {
    throw new Error('PERF_BASE_URL must be a valid URL');
  }
}

function redactBaseUrl(value) {
  return `${value.origin}${value.pathname}`.replace(/\/$/, '');
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function positiveNumber(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return 0;
  return sortedValues[
    Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * fraction) - 1)
  ];
}

function round(value) {
  return Math.round(value * 100) / 100;
}
