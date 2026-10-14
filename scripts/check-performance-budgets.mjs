/* global console, process */

const budgets = {
  apiP95Ms: Number(process.env.API_P95_BUDGET_MS ?? 750),
  webP95Ms: Number(process.env.WEB_P95_BUDGET_MS ?? 1500),
  errorRatePercent: Number(process.env.ERROR_RATE_BUDGET_PERCENT ?? 1),
  queueLagSeconds: Number(process.env.QUEUE_LAG_BUDGET_SECONDS ?? 60),
};

for (const [name, value] of Object.entries(budgets)) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

console.log(`Performance budgets configured: ${JSON.stringify(budgets)}`);
