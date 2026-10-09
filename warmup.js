export function calculateWarmupSets(workingWeightKg, { barKg = 20, roundToKg = 2.5 } = {}) {
  if (typeof workingWeightKg !== 'number' && typeof workingWeightKg !== 'string') return [];
  const weight = Number(workingWeightKg);
  if (!Number.isFinite(weight) || !Number.isFinite(barKg) || barKg <= 0
    || !Number.isFinite(roundToKg) || roundToKg <= 0 || weight <= barKg) return [];

  const steps = weight <= 60
    ? [[barKg, 10], [weight * 0.60, 5]]
    : weight <= 100
      ? [[barKg, 10], [weight * 0.55, 5], [weight * 0.75, 3]]
      : [[weight * 0.50, 5], [weight * 0.67, 3], [weight * 0.83, 2], [weight * 0.92, 1]];

  const sets = new Map();
  for (const [rawWeight, reps] of steps) {
    const weightKg = Math.max(barKg, Number((Math.round(rawWeight / roundToKg) * roundToKg).toFixed(8)));
    if (weightKg >= weight) continue;
    const previous = sets.get(weightKg);
    if (!previous || previous.reps < reps) sets.set(weightKg, { weightKg, reps });
  }
  return [...sets.values()];
}
