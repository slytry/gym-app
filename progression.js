import { getWorkoutExercises } from './program.js?v=22';

export function progressionHint(history, draft, exercise) {
  if (exercise.kind !== 'reps' || !exercise.weight) return '';
  const range = /^\s*(\d+)(?:\s*[–-]\s*(\d+))?\s+повтор/.exec(exercise.target);
  if (!range) return '';
  const upper = Number(range[2] || range[1]);
  const target = range[2] ? 'верхней границы' : 'целевого числа повторов';
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
    return `Сначала достигни ${target} во всех обязательных подходах. Вес автоматически не меняется.`;
  }
  if (sets.some((set) => set.weight === '' || set.weight === undefined || !Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)
    || sets.some((set) => Number(set.weight) !== Number(sets[0].weight))) {
    return 'Для сравнения нужны все обязательные подходы с одним записанным весом.';
  }
  if (sets.some((set) => set.rir === '' || set.rir === undefined)) {
    return `${range[2] ? 'Верхняя граница достигнута' : 'Целевое число повторов достигнуто'}. Запиши RIR: для подсказки повышения нужен запас хотя бы 2 повтора в каждом подходе.`;
  }
  if (sets.some((set) => !Number.isInteger(Number(set.rir)) || Number(set.rir) < 2 || Number(set.rir) > 10)) {
    return `${range[2] ? 'Верхняя граница достигнута' : 'Целевое число повторов достигнуто'}, но запаса 2 повтора пока нет во всех подходах. Не спеши повышать вес.`;
  }
  const increase = exercise.warmup
    ? ['squat', 'front-squat', 'deadlift'].includes(exercise.id) ? ' на 2,5–5 кг в следующую неделю' : ' на 2,5 кг в следующую неделю'
    : '';
  return `В прошлой тренировке все обязательные подходы достигли ${target} с запасом ≥2 повтора. Рассмотри повышение веса${increase}, только если техника уверенная и нет боли. Решение за тобой; вес автоматически не меняется.`;
}
