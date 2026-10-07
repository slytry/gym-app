import { WEIGHT_LABELS, getWorkoutRoutine, getWorkoutExercises } from './program.js?v=19';

export function workoutToMarkdown(workout) {
  const routine = getWorkoutRoutine(workout);
  const lines = [
    `# ${routine.name} — ${workout.date}`,
    '',
    `- Начало: ${formatLocalDateTime(workout.startedAt)}`,
    `- Завершение: ${workout.finishedAt ? formatLocalDateTime(workout.finishedAt) : 'не завершена'}`,
    '- Единицы: для гантелей вес указан на одну гантель; для подтягиваний — только дополнительный вес.',
    ''
  ];
  if (workout.note?.trim()) lines.push('Заметка к тренировке:', ...workout.note.split('\n').map((line) => `> ${line}`), '');

  for (const exercise of getWorkoutExercises(workout)) {
    lines.push(`## ${exercise.name}`);
    lines.push(`План: ${exercise.sets} × ${exercise.target}${exercise.optionalAfter !== undefined ? ` (по самочувствию начиная с подхода ${exercise.optionalAfter + 1})` : ''}.`);
    if (exercise.weight) lines.push(`Вес: ${WEIGHT_LABELS[exercise.weight]}.`);
    lines.push('');

    const results = workout.sets[exercise.id] || [];
    for (let index = 0; index < results.length; index += 1) {
      lines.push(`- Подход ${index + 1}: ${formatSetResult(results[index], exercise)}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function workoutsToMarkdown(workouts) {
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  const header = '# История тренировок\n\n';
  return header + sorted.map(workoutToMarkdown).join('\n---\n\n');
}

export function formatSetResult(set, exercise) {
  if (!set) return 'не завершён';
  const details = [
    ...(set.status === 'done' && set.rir !== undefined && set.rir !== '' ? [`RIR ${set.rir}`] : []),
    ...(set.note?.trim() ? [`заметка: ${set.note}`] : [])
  ];
  if (set.status === 'pending') return ['не завершён', ...details].join(' · ');
  if (set.status === 'skipped') return ['пропущен', ...details].join(' · ');

  const values = [];
  if (exercise.weight && set.weight !== '') values.push(`${set.weight} ${WEIGHT_LABELS[exercise.weight]}`);
  if (exercise.kind === 'reps' && set.reps !== '') values.push(`${set.reps} повт.`);
  if (exercise.kind === 'sides') {
    if (set.leftReps !== '') values.push(`левая ${set.leftReps} повт.`);
    if (set.rightReps !== '') values.push(`правая ${set.rightReps} повт.`);
  }
  if (exercise.kind === 'seconds' && set.seconds !== '') values.push(`${set.seconds} с`);

  return [values.length ? values.join(' × ') : 'выполнен, результат не записан', ...details].join(' · ');
}

export function formatLocalDateTime(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}
