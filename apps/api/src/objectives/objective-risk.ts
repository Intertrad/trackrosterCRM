export function objectiveRisk(
  target: number,
  actual: number,
  startsAt: Date,
  endsAt: Date,
  now: Date,
) {
  const elapsed = Math.min(
    1,
    Math.max(0, (now.getTime() - startsAt.getTime()) / (endsAt.getTime() - startsAt.getTime())),
  );
  const expected = target * elapsed;
  const pace = expected > 0 ? actual / expected : null;
  const status =
    actual >= target
      ? 'achieved'
      : now < startsAt
        ? 'not_started'
        : now >= endsAt
          ? 'missed'
          : pace !== null && pace < 0.8
            ? 'at_risk'
            : pace !== null && pace < 1
              ? 'watch'
              : 'on_track';
  return {
    actual,
    target,
    remaining: Math.max(0, target - actual),
    progressPercent: Math.round((actual / target) * 10000) / 100,
    elapsedPercent: Math.round(elapsed * 10000) / 100,
    expectedToDate: Math.round(expected * 100) / 100,
    projectedAtEnd: elapsed > 0 ? Math.round((actual / elapsed) * 100) / 100 : null,
    status,
    model: 'linear_elapsed_time_v1',
    explanation:
      'At risk below 80% of elapsed-time pace; watch below 100%. Projection is a pace estimate, not a probability.',
  };
}
