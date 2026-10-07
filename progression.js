import { getWorkoutExercises } from './program.js?v=19';

export function progressionHint(history, draft, exercise) {
  if (exercise.kind !== 'reps' || !exercise.weight) return '';
  const range = /^\s*(\d+)(?:\s*[–-]\s*(\d+))?\s+повтор/.exec(exercise.target);
  if (!range) return '';
  const upper = Number(range[2] || range[1]);
  const required = exercise.optionalAfter ?? exercise.sets;
  if (!required) return '';
  const previous = history
    .filter((workout) => workout.routineId === draft.routineId && workout.finishedAt <= draft.startedAt
      && workout.finishedAt && workout.sets[exercise.id])
    .sort((a, b) => b.finishedAt - a.finishedAt)[0];
  if (!previous) return '';
  const planned = getWorkoutExercises(previous).find((item) => item.id === exercise.id);
  if (!planned || ['kind', 'weight', 'target', 'sets', 'optionalAfter'].some((field) => planned[field] !== exercise[field])) {
    return 'План изменился: сначала выполни тренировку в новом диапазоне.';
  }
  const sets = previous.sets[exercise.id].slice(0, required);
  if (sets.length !== required || sets.some((set) => set.status !== 'done' || Number(set.reps) < upper
    || !Number.isInteger(Number(set.reps)) || set.reps === '' || set.reps === undefined)) {
    return 'Сначала достигни верхней границы во всех обязательных подходах. Вес автоматически не меняется.';
  }
  if (sets.some((set) => set.weight === '' || set.weight === undefined || !Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)
    || sets.some((set) => Number(set.weight) !== Number(sets[0].weight))) {
    return 'Для сравнения нужны все обязательные подходы с одним записанным весом.';
  }
  if (sets.some((set) => set.rir === '' || set.rir === undefined)) {
    return 'Верхняя граница достигнута. Запиши RIR: для подсказки повышения нужен запас хотя бы 2 повтора в каждом подходе.';
  }
  if (sets.some((set) => !Number.isInteger(Number(set.rir)) || Number(set.rir) < 2 || Number(set.rir) > 10)) {
    return 'Верхняя граница достигнута, но запаса 2 повтора пока нет во всех подходах. Не спеши повышать вес.';
  }
  return 'В прошлой тренировке все обязательные подходы достигли верхней границы с запасом ≥2 повтора. Рассмотри повышение веса, только если техника уверенная и нет боли. Решение за тобой; вес автоматически не меняется.';
}
